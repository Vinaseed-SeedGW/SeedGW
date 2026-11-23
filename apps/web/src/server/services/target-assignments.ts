import 'server-only';
import type { Prisma } from '@prisma/client';
import type { ExportedFile } from '@seedgw/contracts/common';
import { auditChanges, type AuditChanges } from '@seedgw/contracts/audit';
import { formatNumber } from '@seedgw/contracts/format';
import { collectDescendantIds } from '@seedgw/contracts/org-tree';
import { formatMonthLabel, monthBoundsUtc } from '@seedgw/contracts/sales-targets';
import {
  assignableMonths,
  MAX_TARGET_IMPORT_ROWS,
  parseImportKind,
  parseImportMonth,
  TARGET_IMPORT_COLUMNS,
  type AssignmentRow,
  type AssignmentsResult,
  type AssignTargetInput,
  type TargetAssigneeKind,
  type TargetImportResult,
} from '@seedgw/contracts/target-assignments';
import { db } from '@seedgw/db/client';
import { getAssignableOrgUnitIds, getScopedDb } from '@/server/auth/scoped-db';
import { DomainError } from './domain-error';
import { buildWorkbookBase64, readFirstSheet } from './excel';
import { progressByUser } from './sales-targets';

// Giao chỉ tiêu từ trên xuống (K3). Người giao chỉ thấy và giao cho đơn vị, nhân viên trong phạm vi của mình.

type Unit = { id: string; code: string; name: string; parentId: string | null };

const ASSIGNMENT_SELECT = {
  id: true,
  kind: true,
  orgUnitId: true,
  userId: true,
  visitCountTarget: true,
  dealerCoverageTarget: true,
  note: true,
  updatedAt: true,
  assignedBy: { select: { fullName: true } },
} satisfies Prisma.AssignedSalesTargetSelect;

/** Nhân viên được giao chỉ tiêu: tài khoản đang hoạt động có quyền check-in, trong phạm vi người xem. */
async function scopedStaff() {
  const scoped = await getScopedDb();
  return scoped.user.findMany({
    where: {
      isActive: true,
      roles: { some: { role: { permissions: { some: { code: 'sales.check-in.create' } } } } },
    },
    orderBy: { employeeCode: 'asc' },
    select: {
      id: true,
      employeeCode: true,
      fullName: true,
      orgUnitId: true,
      orgUnit: { select: { name: true } },
    },
  });
}

async function scopedUnits(): Promise<{ all: Unit[]; assignable: Unit[] }> {
  const [all, assignable] = await Promise.all([
    db.orgUnit.findMany({
      orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true, parentId: true },
    }),
    getAssignableOrgUnitIds(),
  ]);
  return { all, assignable: assignable ? all.filter((unit) => assignable.has(unit.id)) : all };
}

/** Lượt ghé thăm và số đại lý khác nhau trong tháng của check-in thuộc đơn vị và các đơn vị con. */
async function unitProgress(
  units: readonly Unit[],
  all: readonly Unit[],
  month: string,
): Promise<Map<string, { visitCount: number; dealerCoverage: number }>> {
  const { start, end } = monthBoundsUtc(month);
  const where = { capturedAt: { gte: start, lte: end }, orgUnitId: { not: null } };
  const [visits, pairs] = await Promise.all([
    db.checkIn.groupBy({ by: ['orgUnitId'], where, _count: { _all: true } }),
    db.checkIn.groupBy({
      by: ['orgUnitId', 'dealerId'],
      where: { ...where, dealerId: { not: null } },
    }),
  ]);
  const result = new Map<string, { visitCount: number; dealerCoverage: number }>();
  for (const unit of units) {
    const tree = collectDescendantIds(all, unit.id);
    tree.add(unit.id);
    const dealers = new Set<string>();
    let visitCount = 0;
    for (const row of visits)
      if (row.orgUnitId && tree.has(row.orgUnitId)) visitCount += row._count._all;
    for (const row of pairs)
      if (row.orgUnitId && row.dealerId && tree.has(row.orgUnitId)) dealers.add(row.dealerId);
    result.set(unit.id, { visitCount, dealerCoverage: dealers.size });
  }
  return result;
}

export async function listAssignments(month: string): Promise<AssignmentsResult> {
  const scoped = await getScopedDb();
  const [{ all, assignable }, staff, assignments] = await Promise.all([
    scopedUnits(),
    scopedStaff(),
    scoped.assignedSalesTarget.findMany({ where: { month }, select: ASSIGNMENT_SELECT }),
  ]);
  const [selfTargets, userProgress, unitResults] = await Promise.all([
    db.monthlySalesTarget.findMany({
      where: { month, userId: { in: staff.map((user) => user.id) }, approvedAt: { not: null } },
      select: { userId: true, approvedVisitCount: true, approvedDealerCoverage: true },
    }),
    progressByUser(
      staff.map((user) => user.id),
      month,
    ),
    unitProgress(assignable, all, month),
  ]);
  const unitAssignment = new Map(
    assignments.filter((row) => row.kind === 'UNIT').map((row) => [row.orgUnitId, row]),
  );
  const userAssignment = new Map(
    assignments.filter((row) => row.kind === 'USER').map((row) => [row.userId, row]),
  );
  const selfByUser = new Map(selfTargets.map((row) => [row.userId, row]));
  const unitNames = new Map(all.map((unit) => [unit.id, unit.name]));

  function assignmentOf(
    row: (typeof assignments)[number] | undefined,
  ): AssignmentRow['assignment'] {
    return row
      ? {
          id: row.id,
          visitCountTarget: row.visitCountTarget,
          dealerCoverageTarget: row.dealerCoverageTarget,
          note: row.note,
          assignedByName: row.assignedBy.fullName,
          updatedAt: row.updatedAt.toISOString(),
        }
      : null;
  }

  return {
    month,
    units: assignable.map((unit) => ({
      kind: 'UNIT',
      assigneeId: unit.id,
      code: unit.code,
      name: unit.name,
      orgUnitName: unit.parentId ? (unitNames.get(unit.parentId) ?? null) : null,
      assignment: assignmentOf(unitAssignment.get(unit.id)),
      selfTarget: null,
      progress: unitResults.get(unit.id) ?? { visitCount: 0, dealerCoverage: 0 },
    })),
    users: staff.map((user) => {
      const self = selfByUser.get(user.id);
      return {
        kind: 'USER',
        assigneeId: user.id,
        code: user.employeeCode,
        name: user.fullName,
        orgUnitName: user.orgUnit?.name ?? null,
        assignment: assignmentOf(userAssignment.get(user.id)),
        selfTarget:
          self?.approvedVisitCount != null && self.approvedDealerCoverage != null
            ? {
                visitCountTarget: self.approvedVisitCount,
                dealerCoverageTarget: self.approvedDealerCoverage,
              }
            : null,
        progress: userProgress.get(user.id) ?? { visitCount: 0, dealerCoverage: 0 },
      };
    }),
  };
}

function assertAssignableMonth(month: string): void {
  if (!assignableMonths().includes(month)) {
    throw new DomainError(
      'VALIDATION',
      'Chỉ giao hoặc sửa được chỉ tiêu tháng này và 2 tháng sau',
      {
        month: 'Tháng đã qua chỉ xem',
      },
    );
  }
}

type Assignee = { kind: TargetAssigneeKind; id: string; label: string; orgUnitId: string | null };

/** Đơn vị hoặc nhân viên được giao phải nằm trong phạm vi người giao. */
async function resolveAssignee(kind: TargetAssigneeKind, id: string): Promise<Assignee> {
  if (kind === 'UNIT') {
    const { assignable } = await scopedUnits();
    const unit = assignable.find((item) => item.id === id);
    if (!unit) throw new DomainError('FORBIDDEN', 'Đơn vị không thuộc phạm vi của bạn');
    return { kind, id, label: `${unit.code} ${unit.name}`, orgUnitId: unit.id };
  }
  const user = (await scopedStaff()).find((item) => item.id === id);
  if (!user) throw new DomainError('FORBIDDEN', 'Nhân viên không thuộc phạm vi của bạn');
  return { kind, id, label: `${user.employeeCode} ${user.fullName}`, orgUnitId: user.orgUnitId };
}

export type AssignOutcome = { id: string; label: string; created: boolean; changes: AuditChanges };

function valuesText(values: { visitCountTarget: number; dealerCoverageTarget: number }): string {
  return `${formatNumber(values.visitCountTarget)} lượt ghé thăm, ${formatNumber(values.dealerCoverageTarget)} đại lý`;
}

async function writeAssignment(
  tx: Prisma.TransactionClient,
  actorId: string,
  assignee: Assignee,
  input: Pick<AssignTargetInput, 'month' | 'visitCountTarget' | 'dealerCoverageTarget' | 'note'>,
): Promise<AssignOutcome> {
  const where: Prisma.AssignedSalesTargetWhereInput =
    assignee.kind === 'UNIT'
      ? { kind: 'UNIT', orgUnitId: assignee.id, month: input.month }
      : { kind: 'USER', userId: assignee.id, month: input.month };
  const existing = await tx.assignedSalesTarget.findFirst({
    where,
    select: { id: true, visitCountTarget: true, dealerCoverageTarget: true, note: true },
  });
  const data = {
    visitCountTarget: input.visitCountTarget,
    dealerCoverageTarget: input.dealerCoverageTarget,
    note: input.note,
    assignedById: actorId,
  };
  const after = { [formatMonthLabel(input.month)]: valuesText(input), 'Ghi chú': input.note };
  if (existing) {
    await tx.assignedSalesTarget.update({ where: { id: existing.id }, data });
    return {
      id: existing.id,
      label: assignee.label,
      created: false,
      changes: auditChanges(
        { [formatMonthLabel(input.month)]: valuesText(existing), 'Ghi chú': existing.note },
        after,
      ),
    };
  }
  const created = await tx.assignedSalesTarget.create({
    data: {
      ...data,
      month: input.month,
      kind: assignee.kind,
      orgUnitId: assignee.orgUnitId,
      userId: assignee.kind === 'USER' ? assignee.id : null,
    },
    select: { id: true },
  });
  return { id: created.id, label: assignee.label, created: true, changes: auditChanges({}, after) };
}

export async function assignTarget(
  actorId: string,
  input: AssignTargetInput,
): Promise<AssignOutcome> {
  assertAssignableMonth(input.month);
  const assignee = await resolveAssignee(input.kind, input.assigneeId);
  return db.$transaction((tx) => writeAssignment(tx, actorId, assignee, input));
}

export async function removeAssignment(id: string): Promise<AssignOutcome> {
  const scoped = await getScopedDb();
  const row = await scoped.assignedSalesTarget.findUnique({
    where: { id },
    select: {
      id: true,
      month: true,
      visitCountTarget: true,
      dealerCoverageTarget: true,
      orgUnit: { select: { code: true, name: true } },
      user: { select: { employeeCode: true, fullName: true } },
    },
  });
  if (!row) throw new DomainError('NOT_FOUND', 'Không tìm thấy chỉ tiêu được giao');
  assertAssignableMonth(row.month);
  await db.assignedSalesTarget.delete({ where: { id } });
  const label = row.user
    ? `${row.user.employeeCode} ${row.user.fullName}`
    : `${row.orgUnit?.code ?? ''} ${row.orgUnit?.name ?? ''}`.trim();
  return {
    id,
    label,
    created: false,
    changes: auditChanges({ [formatMonthLabel(row.month)]: valuesText(row) }, {}),
  };
}

// ---------- Excel ----------

export async function buildAssignmentTemplate(month: string): Promise<ExportedFile> {
  const data = await listAssignments(month);
  const [year, m] = month.split('-');
  const monthText = `${m}/${year}`;
  const rows = [...data.units, ...data.users].map((row) => ({
    month: monthText,
    kind: row.kind === 'UNIT' ? 'Đơn vị' : 'Nhân viên',
    code: row.code,
    name: row.name,
    visits: row.assignment?.visitCountTarget ?? '',
    dealers: row.assignment?.dealerCoverageTarget ?? '',
    note: row.assignment?.note ?? '',
  }));
  const keys = ['month', 'kind', 'code', 'name', 'visits', 'dealers', 'note'] as const;
  return {
    fileName: `giao-chi-tieu-${month}.xlsx`,
    base64: await buildWorkbookBase64(
      'Giao chỉ tiêu',
      TARGET_IMPORT_COLUMNS.map((header, index) => ({
        header,
        width: index === 3 ? 36 : 18,
        value: (row: (typeof rows)[number]) => row[keys[index] ?? 'note'],
        // Mã và tháng giữ dạng chữ để Excel không đổi "11/2026" thành ngày.
        ...(index <= 2 ? { numberFormat: '@' as const } : {}),
      })),
      rows,
    ),
  };
}

function toCount(text: string): number | null {
  const value = Number(text.replace(/[.\s]/g, '').replace(',', '.'));
  return Number.isInteger(value) && value >= 0 && value <= 1_000_000 ? value : null;
}

/**
 * Nhập Excel: kiểm tra hết các dòng trước, có lỗi thì không ghi dòng nào (nhập lại sau khi sửa file).
 * Dòng để trống cả hai ô chỉ tiêu thì bỏ qua.
 */
export async function importAssignments(
  actorId: string,
  data: ArrayBuffer,
): Promise<TargetImportResult & { outcomes: AssignOutcome[] }> {
  const rows = await readFirstSheet(data, TARGET_IMPORT_COLUMNS.length);
  if (!rows) throw new DomainError('VALIDATION', 'Không đọc được file, hãy dùng file mẫu .xlsx');
  if (rows.length > MAX_TARGET_IMPORT_ROWS) {
    throw new DomainError('VALIDATION', `File có quá ${formatNumber(MAX_TARGET_IMPORT_ROWS)} dòng`);
  }
  const [{ assignable }, staff] = await Promise.all([scopedUnits(), scopedStaff()]);
  const unitByCode = new Map(assignable.map((unit) => [unit.code.toUpperCase(), unit]));
  const userByCode = new Map(staff.map((user) => [user.employeeCode.toUpperCase(), user]));
  const months = assignableMonths();
  const errors: TargetImportResult['errors'] = [];
  const plan: {
    assignee: Assignee;
    input: Pick<AssignTargetInput, 'month' | 'visitCountTarget' | 'dealerCoverageTarget' | 'note'>;
  }[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const [
      monthText = '',
      kindText = '',
      code = '',
      ,
      visitsText = '',
      dealersText = '',
      note = '',
    ] = row.cells;
    if (!visitsText.trim() && !dealersText.trim()) continue;
    const fail = (message: string) => errors.push({ row: row.rowNumber, message });
    const month = parseImportMonth(monthText);
    if (!month) {
      fail('Tháng phải có dạng mm/yyyy');
      continue;
    }
    if (!months.includes(month)) {
      fail('Chỉ giao được tháng này và 2 tháng sau');
      continue;
    }
    const kind = parseImportKind(kindText);
    if (!kind) {
      fail('Loại phải là Đơn vị hoặc Nhân viên');
      continue;
    }
    const visits = toCount(visitsText);
    const dealers = toCount(dealersText);
    if (visits === null || dealers === null) {
      fail('Lượt ghé thăm và số đại lý được ghé là số nguyên từ 0 trở lên');
      continue;
    }
    const key = code.trim().toUpperCase();
    let assignee: Assignee | null = null;
    if (kind === 'UNIT') {
      const unit = unitByCode.get(key);
      if (unit)
        assignee = { kind, id: unit.id, label: `${unit.code} ${unit.name}`, orgUnitId: unit.id };
    } else {
      const user = userByCode.get(key);
      if (user) {
        assignee = {
          kind,
          id: user.id,
          label: `${user.employeeCode} ${user.fullName}`,
          orgUnitId: user.orgUnitId,
        };
      }
    }
    if (!assignee) {
      fail(
        `Không có ${kind === 'UNIT' ? 'đơn vị' : 'nhân viên'} mã ${code.trim() || '(trống)'} trong phạm vi của bạn`,
      );
      continue;
    }
    const dedupe = `${kind}:${assignee.id}:${month}`;
    if (seen.has(dedupe)) {
      fail(`Mã ${code.trim()} bị lặp trong cùng tháng`);
      continue;
    }
    seen.add(dedupe);
    plan.push({
      assignee,
      input: {
        month,
        visitCountTarget: visits,
        dealerCoverageTarget: dealers,
        note: note.trim().slice(0, 500),
      },
    });
  }

  if (errors.length > 0) return { applied: 0, errors, outcomes: [] };
  const outcomes = await db.$transaction(
    async (tx) => {
      const done: AssignOutcome[] = [];
      for (const item of plan)
        done.push(await writeAssignment(tx, actorId, item.assignee, item.input));
      return done;
    },
    { timeout: 60_000 },
  );
  return { applied: outcomes.length, errors: [], outcomes };
}
