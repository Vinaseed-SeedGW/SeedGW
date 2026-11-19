import 'server-only';
import { Prisma } from '@prisma/client';
import {
  ACTIVE_APPROVAL_KINDS,
  APPROVAL_CODE_SEQUENCE_KEY,
  APPROVAL_STATUS_LABEL,
  PENDING_APPROVAL_STATUSES,
  resolveApprovalChain,
  type ApprovalChainResult,
  type ApprovalChainUnit,
  type ApprovalDetail,
  type ApprovalKind,
  type ApprovalRow,
  type ApprovalStatus,
  type ListApprovalsInput,
  type ListApprovalsResult,
} from '@dms/contracts/approvals';
import { auditChanges, type AuditChanges } from '@dms/contracts/audit';
import { formatSequenceCode } from '@dms/contracts/settings';
import { db } from '@dms/db/client';
import { getOrgUnitTreeIds } from '@dms/db/org-units';
import type { ScopedDb } from '@dms/db/scoped-client';
import { DomainError } from './domain-error';

type Tx = Prisma.TransactionClient;

const STALE_MESSAGE = 'Phiếu đã được xử lý hoặc đã đổi người duyệt, vui lòng tải lại';
const PENDING = [...PENDING_APPROVAL_STATUSES];

/** Người xem phiếu: canRead là quyền xem phiếu trong phạm vi, canReview là quyền duyệt. */
export type ApprovalViewer = {
  id: string;
  canRead: boolean;
  canReview: boolean;
  /** Quản trị hệ thống: duyệt thay, trả lại thay, rút lại thay mọi phiếu đang chờ. */
  canOverride: boolean;
  scoped: ScopedDb;
};

/** Kết quả một thao tác trên phiếu, dùng để ghi AuditLog ở Server Action hoặc Route Handler. */
export type ApprovalOutcome = {
  requestId: string;
  code: string;
  kind: ApprovalKind;
  subjectId: string;
  status: ApprovalStatus;
  changes: AuditChanges;
};

// ---------- Mã phiếu và người duyệt ----------

/** Cấp mã phiếu trong transaction; lỗi giữa chừng thì số không bị dùng mất. */
export async function issueApprovalCode(tx: Tx, kind: ApprovalKind): Promise<string> {
  const rows = await tx.$queryRaw<Array<{ prefix: string; digits: number; value: number }>>`
    UPDATE code_sequences SET next_value = next_value + 1, updated_at = now()
    WHERE key = ${APPROVAL_CODE_SEQUENCE_KEY[kind]} AND next_value <= range_end
    RETURNING prefix, digits, next_value - 1 AS value
  `;
  const row = rows[0];
  if (!row) {
    throw new DomainError(
      'CONFLICT',
      'Dải mã phiếu đã dùng hết, vui lòng liên hệ Quản trị hệ thống',
    );
  }
  return formatSequenceCode(row.prefix, row.digits, Number(row.value));
}

const UNIT_CHAIN_SELECT = {
  id: true,
  parentId: true,
  managerId: true,
  hasManagerLevel: true,
  manager: { select: { isActive: true } },
} satisfies Prisma.OrgUnitSelect;

type UnitChainRecord = Prisma.OrgUnitGetPayload<{ select: typeof UNIT_CHAIN_SELECT }>;

function toChainUnits(rows: readonly UnitChainRecord[]): ApprovalChainUnit[] {
  return rows.map((unit) => ({
    id: unit.id,
    parentId: unit.parentId,
    managerId: unit.managerId,
    managerActive: unit.manager?.isActive ?? false,
    hasManagerLevel: unit.hasManagerLevel,
  }));
}

const SUBMITTER_CHAIN_SELECT = {
  id: true,
  orgUnitId: true,
  managerId: true,
  manager: { select: { isActive: true } },
} satisfies Prisma.UserSelect;

type SubmitterChainRecord = Prisma.UserGetPayload<{ select: typeof SUBMITTER_CHAIN_SELECT }>;

function chainFor(user: SubmitterChainRecord, units: readonly ApprovalChainUnit[]) {
  return resolveApprovalChain({
    submitterId: user.id,
    submitterOrgUnitId: user.orgUnitId,
    submitterDirectManagerId: user.managerId,
    submitterDirectManagerActive: user.manager?.isActive ?? false,
    units,
  });
}

export async function loadApprovalChain(
  tx: Tx,
  submitterId: string,
): Promise<{ chain: ApprovalChainResult; orgUnitId: string | null }> {
  const user = await tx.user.findUniqueOrThrow({
    where: { id: submitterId },
    select: SUBMITTER_CHAIN_SELECT,
  });
  const units = toChainUnits(await tx.orgUnit.findMany({ select: UNIT_CHAIN_SELECT }));
  return { chain: chainFor(user, units), orgUnitId: user.orgUnitId };
}

// ---------- Gửi duyệt ----------

export type SubmitApprovalInput = {
  kind: ApprovalKind;
  subjectId: string;
  submitterId: string;
  periodStart: Date;
  periodEnd: Date;
  periodLabel: string;
  summaryText: string;
  isLate: boolean;
  snapshot: Prisma.InputJsonValue;
  now: Date;
  /** Người bấm gửi; khác người đứng tên phiếu khi Quản trị hệ thống gửi thay. */
  actorId?: string;
};

export type SubmitApprovalResult = {
  requestId: string;
  code: string;
  status: ApprovalStatus;
  selfApproved: boolean;
};

/**
 * Gửi (hoặc gửi lại từ đầu) phiếu duyệt cho một đối tượng. Mỗi đối tượng có đúng một phiếu, gửi lại thì
 * phiếu quay về bước đầu. Lãnh đạo đơn vị tự đăng ký thì duyệt luôn; người gọi tự áp bản đã duyệt khi
 * selfApproved = true.
 */
export async function submitApproval(
  tx: Tx,
  input: SubmitApprovalInput,
): Promise<SubmitApprovalResult> {
  const { chain, orgUnitId } = await loadApprovalChain(tx, input.submitterId);
  if (!chain.ok) throw new DomainError('CONFLICT', chain.message);

  const existing = await tx.approvalRequest.findUnique({
    where: { kind_subjectId: { kind: input.kind, subjectId: input.subjectId } },
    select: { id: true, code: true, status: true },
  });
  if (existing && PENDING.includes(existing.status)) {
    throw new DomainError(
      'CONFLICT',
      `Phiếu ${existing.code} đang chờ duyệt, rút lại phiếu trước khi sửa`,
    );
  }

  const selfApproved = chain.mode === 'SELF_APPROVED';
  const status: ApprovalStatus = selfApproved
    ? 'APPROVED'
    : chain.mode === 'TWO_STEP'
      ? 'PENDING_MANAGER'
      : 'PENDING_LEADER';
  const currentApproverId = selfApproved
    ? null
    : chain.mode === 'TWO_STEP'
      ? chain.managerApproverId
      : chain.leaderApproverId;

  const data = {
    submittedById: input.submitterId,
    orgUnitId,
    status,
    currentApproverId,
    managerApproverId: chain.managerApproverId,
    leaderApproverId: chain.leaderApproverId,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    periodLabel: input.periodLabel,
    summaryText: input.summaryText,
    isLate: input.isLate,
    submittedAt: input.now,
    decidedAt: selfApproved ? input.now : null,
  };

  let request: { id: string; code: string };
  if (existing) {
    // Chỉ gửi lại được khi phiếu không còn chờ duyệt; hai lần bấm cùng lúc thì lượt sau báo lỗi.
    const updated = await tx.approvalRequest.updateMany({
      where: { id: existing.id, status: { notIn: PENDING } },
      data: { ...data, submissionCount: { increment: 1 } },
    });
    if (updated.count === 0) throw new DomainError('CONFLICT', STALE_MESSAGE);
    request = existing;
  } else {
    const code = await issueApprovalCode(tx, input.kind);
    request = await tx.approvalRequest.create({
      data: { ...data, code, kind: input.kind, subjectId: input.subjectId, submissionCount: 1 },
      select: { id: true, code: true },
    });
  }

  const actions: Prisma.ApprovalActionCreateManyInput[] = [
    {
      requestId: request.id,
      actorId: input.actorId ?? input.submitterId,
      action: 'SUBMIT',
      note:
        input.actorId && input.actorId !== input.submitterId ? 'Quản trị hệ thống gửi thay' : '',
      snapshot: input.snapshot,
      createdAt: input.now,
    },
  ];
  if (selfApproved) {
    actions.push({
      requestId: request.id,
      actorId: input.submitterId,
      action: 'APPROVE',
      step: 'LEADER',
      note: chain.skipReason ?? '',
      createdAt: new Date(input.now.getTime() + 1),
    });
  } else if (chain.skipReason) {
    actions.push({
      requestId: request.id,
      actorId: null,
      action: 'SKIP_STEP',
      step: 'MANAGER',
      note: chain.skipReason,
      createdAt: new Date(input.now.getTime() + 1),
    });
  }
  await tx.approvalAction.createMany({ data: actions });

  return { requestId: request.id, code: request.code, status, selfApproved };
}

// ---------- Áp bản đã duyệt vào đối tượng ----------

/** Gọi khi phiếu qua bước cuối, kể cả khi Lãnh đạo đơn vị tự duyệt lúc gửi. */
export async function applyApproved(
  tx: Tx,
  kind: ApprovalKind,
  subjectId: string,
  now: Date,
): Promise<void> {
  if (kind === 'SALES_TARGET') {
    const target = await tx.monthlySalesTarget.findUniqueOrThrow({
      where: { id: subjectId },
      select: { visitCountTarget: true, dealerCoverageTarget: true, salesKgTarget: true },
    });
    await tx.monthlySalesTarget.update({
      where: { id: subjectId },
      data: {
        approvedVisitCount: target.visitCountTarget,
        approvedDealerCoverage: target.dealerCoverageTarget,
        approvedSalesKg: target.salesKgTarget,
        approvedAt: now,
      },
    });
    return;
  }
  // Tuyến (S8): bản vừa gửi thành bản hiệu lực, bỏ các bản cũ.
  const plan = await tx.routePlan.findUniqueOrThrow({
    where: { id: subjectId },
    select: { currentRevision: true },
  });
  await tx.routePlan.update({
    where: { id: subjectId },
    data: { approvedRevision: plan.currentRevision, approvedAt: now },
  });
  await tx.routePlanStop.deleteMany({
    where: { planId: subjectId, revision: { not: plan.currentRevision } },
  });
}

// ---------- Duyệt, trả lại, rút lại ----------

const DECISION_SELECT = {
  id: true,
  code: true,
  kind: true,
  subjectId: true,
  status: true,
  submittedById: true,
  currentApproverId: true,
  managerApproverId: true,
  leaderApproverId: true,
  currentApprover: { select: { fullName: true } },
} satisfies Prisma.ApprovalRequestSelect;

async function findForDecision(tx: Tx, code: string) {
  const request = await tx.approvalRequest.findUnique({ where: { code }, select: DECISION_SELECT });
  if (!request) throw new DomainError('NOT_FOUND', 'Không tìm thấy phiếu');
  return request;
}

/** Ghi chú khi Quản trị hệ thống làm thay người đang được giao duyệt. */
function onBehalfNote(
  verb: string,
  assignee: string | null,
  actorId: string,
  request: { currentApprover: { fullName: string } | null },
  text: string,
): string {
  if (assignee === actorId) return text;
  const who = request.currentApprover?.fullName ?? 'người duyệt';
  return text ? `${verb} ${who}: ${text}` : `${verb} ${who}`;
}

function statusChange(before: ApprovalStatus, after: ApprovalStatus): AuditChanges {
  return auditChanges(
    { status: APPROVAL_STATUS_LABEL[before] },
    { status: APPROVAL_STATUS_LABEL[after] },
  );
}

/**
 * Người đang được giao duyệt phiếu bấm Duyệt. Bước Quản lý xong thì sang Lãnh đạo; nếu một người giữ cả
 * hai bước thì bước Lãnh đạo tự qua. Hai người (hoặc hai lần bấm) cùng lúc thì chỉ lượt đầu có hiệu lực.
 */
export async function approveRequest(
  actorId: string,
  code: string,
  note: string,
  now = new Date(),
  override = false,
): Promise<ApprovalOutcome> {
  return db.$transaction(async (tx) => {
    const request = await findForDecision(tx, code);
    if (!PENDING.includes(request.status)) throw new DomainError('CONFLICT', STALE_MESSAGE);
    const assignee = request.currentApproverId;
    if (assignee !== actorId && !override) {
      throw new DomainError('FORBIDDEN', 'Phiếu này không chờ bạn duyệt');
    }
    const fullNote = onBehalfNote('Duyệt thay', assignee, actorId, request, note);

    const atManagerStep = request.status === 'PENDING_MANAGER';
    // Duyệt thay đi đúng như người đang được giao bấm duyệt.
    const autoPass = atManagerStep && request.leaderApproverId === assignee;
    const finalStep = !atManagerStep || autoPass;
    const nextStatus: ApprovalStatus = finalStep ? 'APPROVED' : 'PENDING_LEADER';

    const updated = await tx.approvalRequest.updateMany({
      where: { id: request.id, status: request.status, currentApproverId: assignee },
      data: {
        status: nextStatus,
        currentApproverId: finalStep ? null : request.leaderApproverId,
        decidedAt: finalStep ? now : null,
      },
    });
    if (updated.count === 0) throw new DomainError('CONFLICT', STALE_MESSAGE);

    const actions: Prisma.ApprovalActionCreateManyInput[] = [
      {
        requestId: request.id,
        actorId,
        action: 'APPROVE',
        step: atManagerStep ? 'MANAGER' : 'LEADER',
        note: fullNote,
        createdAt: now,
      },
    ];
    if (autoPass) {
      actions.push({
        requestId: request.id,
        actorId: null,
        action: 'AUTO_PASS',
        step: 'LEADER',
        note: 'Quản lý trực tiếp cũng là Lãnh đạo đơn vị',
        createdAt: new Date(now.getTime() + 1),
      });
    }
    await tx.approvalAction.createMany({ data: actions });
    if (finalStep) await applyApproved(tx, request.kind, request.subjectId, now);

    return {
      requestId: request.id,
      code: request.code,
      kind: request.kind,
      subjectId: request.subjectId,
      status: nextStatus,
      changes: auditChanges(
        { status: APPROVAL_STATUS_LABEL[request.status] },
        { status: APPROVAL_STATUS_LABEL[nextStatus], note: fullNote || null },
      ),
    };
  });
}

/** Trả lại kèm lý do. Bản đã duyệt trước đó (nếu có) vẫn giữ hiệu lực. */
export async function returnRequest(
  actorId: string,
  code: string,
  reason: string,
  now = new Date(),
  override = false,
): Promise<ApprovalOutcome> {
  return db.$transaction(async (tx) => {
    const request = await findForDecision(tx, code);
    if (!PENDING.includes(request.status)) throw new DomainError('CONFLICT', STALE_MESSAGE);
    const assignee = request.currentApproverId;
    if (assignee !== actorId && !override) {
      throw new DomainError('FORBIDDEN', 'Phiếu này không chờ bạn duyệt');
    }
    const fullReason = onBehalfNote('Trả lại thay', assignee, actorId, request, reason);
    const updated = await tx.approvalRequest.updateMany({
      where: { id: request.id, status: request.status, currentApproverId: assignee },
      data: { status: 'RETURNED', currentApproverId: null, decidedAt: now },
    });
    if (updated.count === 0) throw new DomainError('CONFLICT', STALE_MESSAGE);
    await tx.approvalAction.create({
      data: {
        requestId: request.id,
        actorId,
        action: 'RETURN',
        step: request.status === 'PENDING_MANAGER' ? 'MANAGER' : 'LEADER',
        note: fullReason,
        createdAt: now,
      },
    });
    return {
      requestId: request.id,
      code: request.code,
      kind: request.kind,
      subjectId: request.subjectId,
      status: 'RETURNED',
      changes: auditChanges(
        { status: APPROVAL_STATUS_LABEL[request.status] },
        { status: APPROVAL_STATUS_LABEL.RETURNED, reason },
      ),
    };
  });
}

/** Rút lại được khi chưa ai duyệt: đang chờ Quản lý, hoặc chờ Lãnh đạo mà phiếu không qua bước Quản lý. */
export function isWithdrawable(status: ApprovalStatus, managerApproverId: string | null): boolean {
  return (
    status === 'PENDING_MANAGER' || (status === 'PENDING_LEADER' && managerApproverId === null)
  );
}

export async function withdrawRequest(
  actorId: string,
  code: string,
  now = new Date(),
  override = false,
): Promise<ApprovalOutcome> {
  return db.$transaction(async (tx) => {
    const request = await findForDecision(tx, code);
    if (request.submittedById !== actorId && !override) {
      throw new DomainError('FORBIDDEN', 'Chỉ người gửi được rút lại phiếu');
    }
    if (!isWithdrawable(request.status, request.managerApproverId)) {
      throw new DomainError(
        'CONFLICT',
        'Phiếu đã có người duyệt hoặc đã xử lý, không rút lại được',
      );
    }
    const updated = await tx.approvalRequest.updateMany({
      where: {
        id: request.id,
        OR: [{ status: 'PENDING_MANAGER' }, { status: 'PENDING_LEADER', managerApproverId: null }],
      },
      data: { status: 'WITHDRAWN', currentApproverId: null, decidedAt: now },
    });
    if (updated.count === 0) throw new DomainError('CONFLICT', STALE_MESSAGE);
    await tx.approvalAction.create({
      data: {
        requestId: request.id,
        actorId,
        action: 'WITHDRAW',
        note: request.submittedById === actorId ? '' : 'Quản trị hệ thống rút lại thay',
        createdAt: now,
      },
    });
    return {
      requestId: request.id,
      code: request.code,
      kind: request.kind,
      subjectId: request.subjectId,
      status: 'WITHDRAWN',
      changes: statusChange(request.status, 'WITHDRAWN'),
    };
  });
}

export type BulkApproveResult = {
  approved: ApprovalOutcome[];
  failed: Array<{ code: string; message: string }>;
};

/** Duyệt nhiều phiếu: từng phiếu một transaction riêng, phiếu lỗi không chặn phiếu khác. */
export async function bulkApprove(
  actorId: string,
  codes: readonly string[],
): Promise<BulkApproveResult> {
  const result: BulkApproveResult = { approved: [], failed: [] };
  for (const code of new Set(codes)) {
    try {
      result.approved.push(await approveRequest(actorId, code, ''));
    } catch (error) {
      if (!(error instanceof DomainError)) throw error;
      result.failed.push({ code, message: error.message });
    }
  }
  return result;
}

// ---------- Đổi người duyệt khi cơ cấu thay đổi ----------

export type ReassignOutcome = {
  requestId: string;
  code: string;
  changes: AuditChanges;
};

/**
 * Tính lại người duyệt của mọi phiếu đang chờ theo cơ cấu hiện tại (đổi Trưởng đơn vị, Quản lý trực tiếp,
 * bật tắt Có cấp Quản lý, chuyển đơn vị, khoá tài khoản). Gọi sau khi transaction đổi cơ cấu đã xong.
 * Số phiếu chờ nhỏ (vài trăm) nên tính lại toàn bộ cho chắc.
 */
export async function refreshPendingApprovers(now = new Date()): Promise<ReassignOutcome[]> {
  return db.$transaction(async (tx) => {
    const pending = await tx.approvalRequest.findMany({
      where: { status: { in: PENDING } },
      select: {
        ...DECISION_SELECT,
        submittedBy: { select: SUBMITTER_CHAIN_SELECT },
        currentApprover: { select: { fullName: true } },
      },
    });
    if (pending.length === 0) return [];
    const units = toChainUnits(await tx.orgUnit.findMany({ select: UNIT_CHAIN_SELECT }));
    const names = new Map<string, string>();
    const nameOf = async (id: string | null) => {
      if (!id) return null;
      if (!names.has(id)) {
        const user = await tx.user.findUnique({ where: { id }, select: { fullName: true } });
        names.set(id, user?.fullName ?? id);
      }
      return names.get(id) ?? null;
    };

    const outcomes: ReassignOutcome[] = [];
    for (const request of pending) {
      const chain = chainFor(request.submittedBy, units);
      // Chưa tìm được người duyệt mới thì giữ nguyên, Quản trị đơn vị sẽ thấy ở tab Tất cả.
      if (!chain.ok) continue;

      let status: ApprovalStatus = request.status;
      let currentApproverId: string | null;
      let note: string;
      if (chain.mode === 'SELF_APPROVED') {
        status = 'APPROVED';
        currentApproverId = null;
        note = 'Người gửi đã là Lãnh đạo đơn vị, phiếu tự duyệt';
      } else if (request.status === 'PENDING_MANAGER' && chain.managerApproverId) {
        currentApproverId = chain.managerApproverId;
        note = 'Đổi Quản lý trực tiếp';
      } else {
        // Đang chờ Lãnh đạo, hoặc chờ Quản lý mà nay không còn bước Quản lý.
        status = 'PENDING_LEADER';
        currentApproverId = chain.leaderApproverId;
        note =
          request.status === 'PENDING_MANAGER'
            ? (chain.skipReason ?? 'Đơn vị không còn cấp Quản lý, chuyển thẳng Trưởng đơn vị')
            : 'Đổi Trưởng đơn vị';
      }

      const managerApproverId =
        request.status === 'PENDING_MANAGER' ? chain.managerApproverId : request.managerApproverId;
      if (
        status === request.status &&
        currentApproverId === request.currentApproverId &&
        chain.leaderApproverId === request.leaderApproverId &&
        managerApproverId === request.managerApproverId
      ) {
        continue;
      }

      const updated = await tx.approvalRequest.updateMany({
        where: {
          id: request.id,
          status: request.status,
          currentApproverId: request.currentApproverId,
        },
        data: {
          status,
          currentApproverId,
          managerApproverId,
          leaderApproverId: chain.leaderApproverId,
          decidedAt: status === 'APPROVED' ? now : null,
        },
      });
      if (updated.count === 0) continue;
      await tx.approvalAction.create({
        data: {
          requestId: request.id,
          actorId: null,
          action: status === 'APPROVED' ? 'AUTO_PASS' : 'REASSIGN',
          step: status === 'PENDING_MANAGER' ? 'MANAGER' : 'LEADER',
          note,
          createdAt: now,
        },
      });
      if (status === 'APPROVED') await applyApproved(tx, request.kind, request.subjectId, now);

      outcomes.push({
        requestId: request.id,
        code: request.code,
        changes: auditChanges(
          {
            status: APPROVAL_STATUS_LABEL[request.status],
            approver: request.currentApprover?.fullName ?? null,
          },
          { status: APPROVAL_STATUS_LABEL[status], approver: await nameOf(currentApproverId) },
        ),
      });
    }
    return outcomes;
  });
}

// ---------- Đọc phiếu ----------

const ROW_SELECT = {
  id: true,
  code: true,
  kind: true,
  subjectId: true,
  submittedById: true,
  orgUnitId: true,
  status: true,
  currentApproverId: true,
  managerApproverId: true,
  periodStart: true,
  periodEnd: true,
  periodLabel: true,
  summaryText: true,
  isLate: true,
  submissionCount: true,
  submittedAt: true,
  decidedAt: true,
  submittedBy: { select: { fullName: true, employeeCode: true } },
  orgUnit: { select: { name: true } },
  currentApprover: { select: { fullName: true } },
} satisfies Prisma.ApprovalRequestSelect;

type RowRecord = Prisma.ApprovalRequestGetPayload<{ select: typeof ROW_SELECT }>;

function toRow(record: RowRecord): ApprovalRow {
  return {
    id: record.id,
    code: record.code,
    kind: record.kind,
    subjectId: record.subjectId,
    submittedById: record.submittedById,
    submittedByName: record.submittedBy.fullName,
    submittedByCode: record.submittedBy.employeeCode,
    orgUnitId: record.orgUnitId,
    orgUnitName: record.orgUnit?.name ?? null,
    status: record.status,
    currentApproverId: record.currentApproverId,
    currentApproverName: record.currentApprover?.fullName ?? null,
    periodStart: record.periodStart.toISOString(),
    periodEnd: record.periodEnd.toISOString(),
    periodLabel: record.periodLabel,
    summaryText: record.summaryText,
    isLate: record.isLate,
    submissionCount: Math.max(record.submissionCount, 1),
    submittedAt: record.submittedAt?.toISOString() ?? null,
    decidedAt: record.decidedAt?.toISOString() ?? null,
  };
}

async function filterWhere(input: ListApprovalsInput): Promise<Prisma.ApprovalRequestWhereInput> {
  const unitIds = input.orgUnitId ? await getOrgUnitTreeIds(input.orgUnitId) : null;
  const q = input.q?.trim();
  return {
    status: { not: 'DRAFT' },
    kind:
      input.kind && ACTIVE_APPROVAL_KINDS.includes(input.kind)
        ? input.kind
        : { in: [...ACTIVE_APPROVAL_KINDS] },
    ...(unitIds ? { orgUnitId: { in: unitIds } } : {}),
    ...(input.submittedById ? { submittedById: input.submittedById } : {}),
    ...(input.lateOnly ? { isLate: true } : {}),
    ...(q
      ? {
          OR: [
            { code: { contains: q, mode: 'insensitive' } },
            { submittedBy: { fullName: { contains: q, mode: 'insensitive' } } },
            { submittedBy: { employeeCode: { contains: q, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };
}

/**
 * Chờ tôi duyệt và Đã xử lý tính theo người được giao (không theo phạm vi dữ liệu) vì người duyệt có thể
 * ở đơn vị cha. Tất cả trong phạm vi dùng client có phạm vi của người xem.
 */
export async function listApprovals(
  viewer: ApprovalViewer,
  input: ListApprovalsInput,
): Promise<ListApprovalsResult> {
  const filters = await filterWhere(input);
  const skip = (input.page - 1) * input.pageSize;

  if (input.tab === 'tat-ca') {
    if (!viewer.canRead) throw new DomainError('FORBIDDEN', 'Bạn không có quyền xem phiếu');
    const [rows, total] = await Promise.all([
      viewer.scoped.approvalRequest.findMany({
        where: filters,
        orderBy: [{ submittedAt: 'desc' }, { id: 'asc' }],
        skip,
        take: input.pageSize,
        select: ROW_SELECT,
      }),
      viewer.scoped.approvalRequest.count({ where: filters }),
    ]);
    return { items: rows.map(toRow), total, page: input.page, pageSize: input.pageSize };
  }

  const where: Prisma.ApprovalRequestWhereInput =
    input.tab === 'cho-toi-duyet'
      ? { AND: [filters, { currentApproverId: viewer.id, status: { in: PENDING } }] }
      : {
          AND: [
            filters,
            {
              actions: {
                some: { actorId: viewer.id, action: { in: ['APPROVE', 'RETURN'] } },
              },
            },
          ],
        };
  const [rows, total] = await Promise.all([
    db.approvalRequest.findMany({
      where,
      orderBy:
        input.tab === 'cho-toi-duyet'
          ? [{ submittedAt: 'asc' }, { id: 'asc' }]
          : [{ updatedAt: 'desc' }, { id: 'asc' }],
      skip,
      take: input.pageSize,
      select: ROW_SELECT,
    }),
    db.approvalRequest.count({ where }),
  ]);
  return { items: rows.map(toRow), total, page: input.page, pageSize: input.pageSize };
}

export async function countPendingForApprover(approverId: string): Promise<number> {
  return db.approvalRequest.count({
    where: {
      currentApproverId: approverId,
      status: { in: PENDING },
      kind: { in: [...ACTIVE_APPROVAL_KINDS] },
    },
  });
}

/**
 * Xem phiếu khi là người gửi, người duyệt (đang hoặc đã), hoặc có quyền xem phiếu và phiếu nằm trong
 * phạm vi dữ liệu.
 */
export async function readApproval(viewer: ApprovalViewer, code: string): Promise<ApprovalDetail> {
  const record = await db.approvalRequest.findUnique({
    where: { code },
    select: {
      ...ROW_SELECT,
      leaderApproverId: true,
      actions: {
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          actorId: true,
          action: true,
          step: true,
          note: true,
          createdAt: true,
          actor: { select: { fullName: true } },
        },
      },
    },
  });
  // Phiếu của loại đang hold (Chỉ tiêu) coi như không có.
  if (!record || record.status === 'DRAFT' || !ACTIVE_APPROVAL_KINDS.includes(record.kind)) {
    throw new DomainError('NOT_FOUND', 'Không tìm thấy phiếu');
  }
  const involved =
    record.submittedById === viewer.id ||
    record.currentApproverId === viewer.id ||
    record.managerApproverId === viewer.id ||
    record.leaderApproverId === viewer.id ||
    record.actions.some((action) => action.actorId === viewer.id);
  const inScope =
    !involved &&
    viewer.canRead &&
    (await viewer.scoped.approvalRequest.count({ where: { id: record.id } })) > 0;
  if (!involved && !inScope) throw new DomainError('NOT_FOUND', 'Không tìm thấy phiếu');
  const canReviewNow =
    PENDING.includes(record.status) &&
    ((viewer.canReview && record.currentApproverId === viewer.id) || viewer.canOverride);

  return {
    ...toRow(record),
    canReview: canReviewNow,
    onBehalfOf:
      canReviewNow && record.currentApproverId !== viewer.id
        ? (record.currentApprover?.fullName ?? null)
        : null,
    canWithdraw:
      (record.submittedById === viewer.id || viewer.canOverride) &&
      isWithdrawable(record.status, record.managerApproverId),
    actions: record.actions.map((action) => ({
      id: action.id,
      actorId: action.actorId,
      actorName: action.actor?.fullName ?? null,
      action: action.action,
      step: action.step,
      note: action.note,
      createdAt: action.createdAt.toISOString(),
    })),
  };
}

export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
