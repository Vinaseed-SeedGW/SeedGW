import 'server-only';
import type { Prisma } from '@prisma/client';
import type { ApprovalStatus } from '@seedgw/contracts/approvals';
import { auditChanges, type AuditChanges } from '@seedgw/contracts/audit';
import { formatNumber } from '@seedgw/contracts/format';
import {
  currentVnMonth,
  formatMonthLabel,
  isEditableTargetMonth,
  monthBoundsUtc,
  shiftMonth,
  type ApprovedTargetValues,
  type ListSalesTargetsInput,
  type ListSalesTargetsResult,
  type MyTargetsResult,
  type SalesTargetApprovalView,
  type SalesTargetSnapshot,
  type TargetProgress,
  type UpsertSalesTargetInput,
} from '@seedgw/contracts/sales-targets';
import { db } from '@seedgw/db/client';
import type { ScopedDb } from '@seedgw/db/scoped-client';
import { applyApproved, isUniqueViolation, isWithdrawable, submitApproval } from './approvals';
import { DomainError } from './domain-error';

// Tháng đã qua hiện thêm 3 tháng gần nhất để xem lại.
const PAST_MONTHS_SHOWN = 3;

export type SalesTargetOutcome = {
  targetId: string;
  requestId: string;
  month: string;
  code: string;
  status: ApprovalStatus;
  selfApproved: boolean;
  created: boolean;
  changes: AuditChanges;
};

function summaryOf(
  values: Pick<SalesTargetSnapshot, 'visitCountTarget' | 'dealerCoverageTarget' | 'salesKgTarget'>,
) {
  return `${formatNumber(values.visitCountTarget)} lượt ghé thăm, ${formatNumber(values.dealerCoverageTarget)} đại lý, ${formatNumber(values.salesKgTarget)} kg Thực bán`;
}

/**
 * Đăng ký hoặc sửa chỉ tiêu tháng của chính mình rồi gửi duyệt (K3a). Sửa chỉ tiêu đã duyệt tạo bản đề
 * nghị mới, bản cũ vẫn hiệu lực đến khi bản mới được duyệt. Đang chờ duyệt thì phải rút lại trước khi sửa.
 */
export async function submitSalesTarget(
  userId: string,
  input: UpsertSalesTargetInput,
  now = new Date(),
  actorId = userId,
): Promise<SalesTargetOutcome> {
  if (!isEditableTargetMonth(input.month, now.getTime())) {
    throw new DomainError(
      'VALIDATION',
      'Chỉ đăng ký hoặc sửa được chỉ tiêu tháng này và tháng sau',
      {
        month: 'Chỉ chọn được tháng này hoặc tháng sau',
      },
    );
  }
  const { start, end } = monthBoundsUtc(input.month);
  const values = {
    visitCountTarget: input.visitCountTarget,
    dealerCoverageTarget: input.dealerCoverageTarget,
    salesKgTarget: input.salesKgTarget,
    note: input.note,
  };

  try {
    return await db.$transaction(async (tx) => {
      const [user, existing] = await Promise.all([
        tx.user.findUniqueOrThrow({ where: { id: userId }, select: { orgUnitId: true } }),
        tx.monthlySalesTarget.findUnique({
          where: { userId_month: { userId, month: input.month } },
          select: {
            id: true,
            visitCountTarget: true,
            dealerCoverageTarget: true,
            salesKgTarget: true,
            note: true,
          },
        }),
      ]);
      const target = existing
        ? await tx.monthlySalesTarget.update({
            where: { id: existing.id },
            data: { ...values, orgUnitId: user.orgUnitId },
            select: { id: true },
          })
        : await tx.monthlySalesTarget.create({
            data: { ...values, userId, month: input.month, orgUnitId: user.orgUnitId },
            select: { id: true },
          });

      const submitted = await submitApproval(tx, {
        kind: 'SALES_TARGET',
        subjectId: target.id,
        submitterId: userId,
        periodStart: start,
        periodEnd: end,
        periodLabel: formatMonthLabel(input.month),
        summaryText: summaryOf(values),
        isLate: false,
        snapshot: { month: input.month, ...values } satisfies SalesTargetSnapshot,
        now,
        actorId,
      });
      if (submitted.selfApproved) await applyApproved(tx, 'SALES_TARGET', target.id, now);

      return {
        targetId: target.id,
        requestId: submitted.requestId,
        month: input.month,
        code: submitted.code,
        status: submitted.status,
        selfApproved: submitted.selfApproved,
        created: !existing,
        changes: auditChanges(
          existing
            ? {
                month: formatMonthLabel(input.month),
                visitCountTarget: existing.visitCountTarget,
                dealerCoverageTarget: existing.dealerCoverageTarget,
                salesKgTarget: existing.salesKgTarget,
                note: existing.note || null,
              }
            : {},
          {
            month: formatMonthLabel(input.month),
            visitCountTarget: values.visitCountTarget,
            dealerCoverageTarget: values.dealerCoverageTarget,
            salesKgTarget: values.salesKgTarget,
            note: values.note || null,
          },
        ),
      };
    });
  } catch (error) {
    // Hai lần gửi cùng lúc cho cùng tháng: lượt sau gặp khoá trùng.
    if (isUniqueViolation(error)) {
      throw new DomainError('CONFLICT', 'Chỉ tiêu tháng này vừa được gửi, vui lòng tải lại');
    }
    throw error;
  }
}

// ---------- Kết quả thực tế ----------

/** Lượt ghé thăm là số check-in; số đại lý được ghé là số đại lý khác nhau đã check-in trong tháng. */
async function progressByUser(
  userIds: readonly string[],
  month: string,
): Promise<Map<string, TargetProgress>> {
  const result = new Map<string, TargetProgress>();
  if (userIds.length === 0) return result;
  const { start, end } = monthBoundsUtc(month);
  const where: Prisma.CheckInWhereInput = {
    userId: { in: [...userIds] },
    capturedAt: { gte: start, lte: end },
  };
  const [visits, dealers] = await Promise.all([
    db.checkIn.groupBy({ by: ['userId'], where, _count: { _all: true } }),
    db.checkIn.groupBy({
      by: ['userId', 'dealerId'],
      where: { ...where, dealerId: { not: null } },
    }),
  ]);
  for (const id of userIds) result.set(id, { visitCount: 0, dealerCoverage: 0 });
  for (const row of visits) {
    const entry = result.get(row.userId);
    if (entry) entry.visitCount = row._count._all;
  }
  for (const row of dealers) {
    const entry = result.get(row.userId);
    if (entry) entry.dealerCoverage += 1;
  }
  return result;
}

const TARGET_SELECT = {
  id: true,
  userId: true,
  month: true,
  visitCountTarget: true,
  dealerCoverageTarget: true,
  salesKgTarget: true,
  note: true,
  approvedVisitCount: true,
  approvedDealerCoverage: true,
  approvedSalesKg: true,
  approvedAt: true,
} satisfies Prisma.MonthlySalesTargetSelect;

type TargetRecord = Prisma.MonthlySalesTargetGetPayload<{ select: typeof TARGET_SELECT }>;

function proposedOf(record: TargetRecord): SalesTargetSnapshot {
  return {
    month: record.month,
    visitCountTarget: record.visitCountTarget,
    dealerCoverageTarget: record.dealerCoverageTarget,
    salesKgTarget: record.salesKgTarget,
    note: record.note,
  };
}

function approvedOf(record: TargetRecord): ApprovedTargetValues | null {
  if (record.approvedAt === null || record.approvedVisitCount === null) return null;
  return {
    visitCountTarget: record.approvedVisitCount,
    dealerCoverageTarget: record.approvedDealerCoverage ?? 0,
    salesKgTarget: record.approvedSalesKg ?? 0,
    approvedAt: record.approvedAt.toISOString(),
  };
}

async function requestsFor(targetIds: readonly string[]) {
  const rows = await db.approvalRequest.findMany({
    where: { kind: 'SALES_TARGET', subjectId: { in: [...targetIds] } },
    select: {
      subjectId: true,
      code: true,
      status: true,
      managerApproverId: true,
      actions: {
        where: { action: 'RETURN' },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { note: true },
      },
    },
  });
  return new Map(rows.map((row) => [row.subjectId, row]));
}

/** Chỉ tiêu của chính mình: tháng sau, tháng này và 3 tháng trước, kèm kết quả thực tế. */
export async function readMyTargets(
  userId: string,
  canRegister: boolean,
  now = new Date(),
): Promise<MyTargetsResult> {
  const current = currentVnMonth(now.getTime());
  const months = [shiftMonth(current, 1), current];
  for (let back = 1; back <= PAST_MONTHS_SHOWN; back += 1) months.push(shiftMonth(current, -back));

  const targets = await db.monthlySalesTarget.findMany({
    where: { userId, month: { in: months } },
    select: TARGET_SELECT,
  });
  const [requests, progressList] = await Promise.all([
    requestsFor(targets.map((target) => target.id)),
    // Tháng sau chưa có check-in nên không cần đếm.
    Promise.all(months.slice(1).map((month) => progressByUser([userId], month))),
  ]);
  const byMonth = new Map(targets.map((target) => [target.month, target]));

  return {
    months: months.map((month, index) => {
      const record = byMonth.get(month);
      const request = record ? requests.get(record.id) : undefined;
      const progress =
        index === 0
          ? { visitCount: 0, dealerCoverage: 0 }
          : (progressList[index - 1]?.get(userId) ?? { visitCount: 0, dealerCoverage: 0 });
      return {
        month,
        monthLabel: formatMonthLabel(month),
        editable: canRegister && isEditableTargetMonth(month, now.getTime()),
        target: record
          ? {
              proposed: proposedOf(record),
              approved: approvedOf(record),
              approvalCode: request?.code ?? null,
              approvalStatus: request?.status ?? null,
              returnReason:
                request?.status === 'RETURNED' ? (request.actions[0]?.note ?? null) : null,
              canWithdraw: request
                ? isWithdrawable(request.status, request.managerApproverId)
                : false,
            }
          : null,
        progress,
      };
    }),
  };
}

/** Chỉ tiêu của nhân viên trong phạm vi dữ liệu của người xem, theo một tháng. */
export async function listScopeTargets(
  scoped: ScopedDb,
  input: ListSalesTargetsInput,
  now = new Date(),
): Promise<ListSalesTargetsResult & { month: string }> {
  const month = input.month ?? currentVnMonth(now.getTime());
  const q = input.q?.trim();
  const where: Prisma.MonthlySalesTargetWhereInput = {
    month,
    ...(q
      ? {
          OR: [
            { user: { fullName: { contains: q, mode: 'insensitive' } } },
            { user: { employeeCode: { contains: q, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    scoped.monthlySalesTarget.findMany({
      where,
      orderBy: [{ user: { fullName: 'asc' } }, { id: 'asc' }],
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
      select: {
        ...TARGET_SELECT,
        user: { select: { fullName: true, employeeCode: true } },
        orgUnit: { select: { name: true } },
      },
    }),
    scoped.monthlySalesTarget.count({ where }),
  ]);
  const [requests, progress] = await Promise.all([
    requestsFor(rows.map((row) => row.id)),
    progressByUser(
      rows.map((row) => row.userId),
      month,
    ),
  ]);
  return {
    month,
    items: rows.map((row) => {
      const request = requests.get(row.id);
      return {
        id: row.id,
        userId: row.userId,
        userName: row.user.fullName,
        userCode: row.user.employeeCode,
        orgUnitName: row.orgUnit?.name ?? null,
        month: row.month,
        proposed: proposedOf(row),
        approved: approvedOf(row),
        approvalCode: request?.code ?? null,
        approvalStatus: request?.status ?? null,
        progress: progress.get(row.userId) ?? { visitCount: 0, dealerCoverage: 0 },
      };
    }),
    total,
    page: input.page,
    pageSize: input.pageSize,
  };
}

/** Phần chỉ tiêu trên trang chi tiết phiếu (người xem đã được kiểm quyền xem phiếu trước đó). */
export async function readTargetApprovalView(
  targetId: string,
): Promise<SalesTargetApprovalView | null> {
  const record = await db.monthlySalesTarget.findUnique({
    where: { id: targetId },
    select: TARGET_SELECT,
  });
  if (!record) return null;
  const progress = await progressByUser([record.userId], record.month);
  return {
    proposed: proposedOf(record),
    approved: approvedOf(record),
    progress: progress.get(record.userId) ?? { visitCount: 0, dealerCoverage: 0 },
  };
}
