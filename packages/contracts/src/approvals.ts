import { z } from 'zod';
import { MAX_PAGE_SIZE, pageResult } from './common';

export const approvalKind = z.enum(['ROUTE_PLAN', 'SALES_TARGET']);
export type ApprovalKind = z.infer<typeof approvalKind>;

export const APPROVAL_KIND_LABEL: Record<ApprovalKind, string> = {
  ROUTE_PLAN: 'Tuyến viếng thăm',
  SALES_TARGET: 'Chỉ tiêu tháng',
};

export const approvalStatus = z.enum([
  'DRAFT',
  'PENDING_MANAGER',
  'PENDING_LEADER',
  'RETURNED',
  'APPROVED',
  'WITHDRAWN',
]);
export type ApprovalStatus = z.infer<typeof approvalStatus>;

export const APPROVAL_STATUS_LABEL: Record<ApprovalStatus, string> = {
  DRAFT: 'Nháp',
  PENDING_MANAGER: 'Chờ Quản lý duyệt',
  PENDING_LEADER: 'Chờ Lãnh đạo duyệt',
  RETURNED: 'Trả lại',
  APPROVED: 'Đã duyệt',
  WITHDRAWN: 'Đã rút lại',
};

export const PENDING_APPROVAL_STATUSES: readonly ApprovalStatus[] = [
  'PENDING_MANAGER',
  'PENDING_LEADER',
];

export const approvalActionType = z.enum([
  'SUBMIT',
  'APPROVE',
  'RETURN',
  'WITHDRAW',
  'AUTO_PASS',
  'SKIP_STEP',
  'REASSIGN',
]);
export type ApprovalActionType = z.infer<typeof approvalActionType>;

export const APPROVAL_ACTION_LABEL: Record<ApprovalActionType, string> = {
  SUBMIT: 'Gửi duyệt',
  APPROVE: 'Đã duyệt',
  RETURN: 'Trả lại',
  WITHDRAW: 'Rút lại phiếu',
  AUTO_PASS: 'Tự chuyển qua bước Lãnh đạo',
  SKIP_STEP: 'Bỏ qua bước Quản lý',
  REASSIGN: 'Đổi người duyệt',
};

export const approvalStep = z.enum(['MANAGER', 'LEADER']);
export type ApprovalStep = z.infer<typeof approvalStep>;

export const APPROVAL_STEP_LABEL: Record<ApprovalStep, string> = {
  MANAGER: 'Quản lý trực tiếp',
  LEADER: 'Lãnh đạo đơn vị',
};

export const APPROVAL_CODE_SEQUENCE_KEY: Record<ApprovalKind, string> = {
  ROUTE_PLAN: 'route-plan',
  SALES_TARGET: 'sales-target',
};

export type ApprovalChainUnit = {
  id: string;
  parentId: string | null;
  managerId: string | null;
  managerActive: boolean;
  hasManagerLevel: boolean;
};

export type ApprovalChainInput = {
  submitterId: string;
  submitterOrgUnitId: string | null;
  submitterDirectManagerId: string | null;
  submitterDirectManagerActive: boolean;
  units: readonly ApprovalChainUnit[];
};

export type ApprovalChainResult =
  | {
      ok: true;
      mode: 'SELF_APPROVED' | 'LEADER_ONLY' | 'TWO_STEP';
      managerApproverId: string | null;
      leaderApproverId: string;
      sameApprover: boolean;
      skipReason: string | null;
    }
  | {
      ok: false;
      reason: 'NO_ORG_UNIT' | 'NO_LEADER';
      message: string;
    };

/**
 * Quyết định 31 (17/11/2026):
 * - Lãnh đạo đơn vị (Trưởng đơn vị của đơn vị trực tiếp) đăng ký thì tự duyệt, không qua cấp cha.
 * - Đơn vị bật Có cấp Quản lý (không kế thừa) và có Quản lý trực tiếp đang hoạt động: qua Quản lý rồi Trưởng đơn vị.
 * - Không có Quản lý trực tiếp (hoặc bị khoá): bỏ bước Quản lý, lên thẳng Trưởng đơn vị.
 * - Một người giữ cả hai bước: bước 1 duyệt thì bước 2 tự qua (sameApprover = true).
 */
export function resolveApprovalChain(input: ApprovalChainInput): ApprovalChainResult {
  const byId = new Map(input.units.map((unit) => [unit.id, unit]));
  const directUnit = input.submitterOrgUnitId ? byId.get(input.submitterOrgUnitId) : undefined;
  if (!directUnit) {
    return {
      ok: false,
      reason: 'NO_ORG_UNIT',
      message: 'Tài khoản chưa được gán đơn vị, vui lòng liên hệ Quản trị đơn vị',
    };
  }

  if (directUnit.managerId === input.submitterId) {
    return {
      ok: true,
      mode: 'SELF_APPROVED',
      managerApproverId: null,
      leaderApproverId: input.submitterId,
      sameApprover: false,
      skipReason: 'Lãnh đạo đơn vị tự đăng ký và tự duyệt',
    };
  }

  let leaderApproverId: string | null = null;
  let cursor: ApprovalChainUnit | undefined = directUnit;
  const visited = new Set<string>();
  while (cursor && !visited.has(cursor.id)) {
    visited.add(cursor.id);
    if (cursor.managerId && cursor.managerActive) {
      leaderApproverId = cursor.managerId;
      break;
    }
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }

  if (!leaderApproverId) {
    return {
      ok: false,
      reason: 'NO_LEADER',
      message: 'Đơn vị chưa có Trưởng đơn vị để duyệt, vui lòng liên hệ Quản trị đơn vị',
    };
  }

  let managerApproverId: string | null = null;
  let skipReason: string | null = null;
  if (directUnit.hasManagerLevel) {
    if (
      input.submitterDirectManagerId &&
      input.submitterDirectManagerActive &&
      input.submitterDirectManagerId !== input.submitterId
    ) {
      managerApproverId = input.submitterDirectManagerId;
    } else {
      skipReason = 'Nhân viên chưa có Quản lý trực tiếp đang hoạt động, chuyển thẳng Trưởng đơn vị';
    }
  }

  return {
    ok: true,
    mode: managerApproverId ? 'TWO_STEP' : 'LEADER_ONLY',
    managerApproverId,
    leaderApproverId,
    sameApprover: managerApproverId !== null && managerApproverId === leaderApproverId,
    skipReason,
  };
}

export const APPROVAL_TABS = ['cho-toi-duyet', 'da-xu-ly', 'tat-ca'] as const;
export type ApprovalTab = (typeof APPROVAL_TABS)[number];

export const approvalRow = z.object({
  id: z.uuid(),
  code: z.string(),
  kind: approvalKind,
  subjectId: z.uuid(),
  submittedById: z.uuid(),
  submittedByName: z.string(),
  submittedByCode: z.string(),
  orgUnitId: z.uuid().nullable(),
  orgUnitName: z.string().nullable(),
  status: approvalStatus,
  currentApproverId: z.uuid().nullable(),
  currentApproverName: z.string().nullable(),
  periodStart: z.iso.datetime(),
  periodEnd: z.iso.datetime(),
  periodLabel: z.string(),
  summaryText: z.string(),
  isLate: z.boolean(),
  submissionCount: z.number().int().positive(),
  submittedAt: z.iso.datetime().nullable(),
  decidedAt: z.iso.datetime().nullable(),
});
export type ApprovalRow = z.infer<typeof approvalRow>;

export const listApprovalsResult = pageResult(approvalRow);
export type ListApprovalsResult = z.infer<typeof listApprovalsResult>;

export const APPROVAL_PAGE_SIZE = 20;

export const listApprovalsInput = z.object({
  tab: z.enum(APPROVAL_TABS).default('cho-toi-duyet'),
  kind: approvalKind.optional(),
  orgUnitId: z.uuid().optional(),
  submittedById: z.uuid().optional(),
  lateOnly: z.boolean().default(false),
  q: z.string().trim().max(100).optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(MAX_PAGE_SIZE).default(APPROVAL_PAGE_SIZE),
});
export type ListApprovalsInput = z.infer<typeof listApprovalsInput>;

export const approvalsUrlParams = z
  .object({
    tab: z.enum(APPROVAL_TABS).catch('cho-toi-duyet'),
    loai: approvalKind.optional().catch(undefined),
    'don-vi': z.uuid().optional().catch(undefined),
    'nhan-vien': z.uuid().optional().catch(undefined),
    'nop-muon': z.enum(['1']).optional().catch(undefined),
    q: z.string().trim().max(100).optional().catch(undefined),
    trang: z.coerce.number().int().positive().max(1_000_000).catch(1),
  })
  .transform((url): ListApprovalsInput => ({
    tab: url.tab,
    kind: url.loai,
    orgUnitId: url['don-vi'],
    submittedById: url['nhan-vien'],
    lateOnly: url['nop-muon'] === '1',
    q: url.q || undefined,
    page: url.trang,
    pageSize: APPROVAL_PAGE_SIZE,
  }));

export const approvalActionItem = z.object({
  id: z.uuid(),
  actorId: z.uuid().nullable(),
  actorName: z.string().nullable(),
  action: approvalActionType,
  step: approvalStep.nullable(),
  note: z.string(),
  createdAt: z.iso.datetime(),
});
export type ApprovalActionItem = z.infer<typeof approvalActionItem>;

export const approvalDetail = approvalRow.extend({
  canReview: z.boolean(),
  canWithdraw: z.boolean(),
  actions: z.array(approvalActionItem),
});
export type ApprovalDetail = z.infer<typeof approvalDetail>;

export const approveDecisionInput = z.object({
  code: z.string().trim().min(1),
  note: z.string().trim().max(500, 'Ghi chú tối đa 500 ký tự').default(''),
});
export type ApproveDecisionInput = z.infer<typeof approveDecisionInput>;

export const returnDecisionInput = z.object({
  code: z.string().trim().min(1),
  reason: z
    .string()
    .trim()
    .min(5, 'Lý do trả lại cần ít nhất 5 ký tự')
    .max(500, 'Lý do trả lại tối đa 500 ký tự'),
});
export type ReturnDecisionInput = z.infer<typeof returnDecisionInput>;

export const bulkApproveInput = z.object({
  codes: z.array(z.string().trim().min(1)).min(1, 'Chọn ít nhất một phiếu').max(100),
});
export type BulkApproveInput = z.infer<typeof bulkApproveInput>;

export const withdrawApprovalInput = z.object({
  code: z.string().trim().min(1),
});
export type WithdrawApprovalInput = z.infer<typeof withdrawApprovalInput>;

export const mobileApprovalDecisionInput = z.discriminatedUnion('decision', [
  z.object({ decision: z.literal('APPROVE'), note: z.string().trim().max(500).default('') }),
  z.object({
    decision: z.literal('RETURN'),
    reason: z
      .string()
      .trim()
      .min(5, 'Lý do trả lại cần ít nhất 5 ký tự')
      .max(500, 'Lý do trả lại tối đa 500 ký tự'),
  }),
]);
export type MobileApprovalDecisionInput = z.infer<typeof mobileApprovalDecisionInput>;
