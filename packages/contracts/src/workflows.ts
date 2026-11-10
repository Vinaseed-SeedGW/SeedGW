import { z } from 'zod';
import { pageResult } from './common';
import { formatDateOnly, formatVnd, parseDisplayDate } from './format';
import { integerInRange } from './settings';

export const MAX_WORKFLOW_STEPS = 20;
export const MAX_STEP_CONDITIONS = 10;
const MAX_AMOUNT_VND = 1_000_000_000_000;
const MAX_SLA_HOURS = 720;
const DEFAULT_SLA_HOURS = 24;

function optionsOf<T extends string>(labels: Record<T, string>) {
  return (Object.entries(labels) as Array<[T, string]>).map(([value, label]) => ({ value, label }));
}

export const DEALER_TIER_LABEL = {
  LEVEL_1: 'Đại lý cấp 1',
  LEVEL_2: 'Đại lý cấp 2',
} as const;
export type DealerTier = keyof typeof DEALER_TIER_LABEL;
export const DEALER_TIER_OPTIONS = optionsOf(DEALER_TIER_LABEL);
const dealerTier = z.enum(['LEVEL_1', 'LEVEL_2'], { error: 'Vui lòng chọn loại đại lý' });

export const APPROVER_TYPE_LABEL = {
  ROLE: 'Vai trò trong đơn vị người tạo',
  JOB_TITLE: 'Chức danh ở đơn vị cấp trên',
  USER: 'Người cụ thể',
} as const;
export type ApproverType = keyof typeof APPROVER_TYPE_LABEL;
export const APPROVER_TYPE_OPTIONS = optionsOf(APPROVER_TYPE_LABEL);

export const APPROVAL_MODE_LABEL = {
  ANY: 'Một người bất kỳ',
  ALL: 'Tất cả cùng duyệt',
} as const;
export type ApprovalMode = keyof typeof APPROVAL_MODE_LABEL;
export const APPROVAL_MODE_OPTIONS = optionsOf(APPROVAL_MODE_LABEL);

export const ESCALATION_TYPE_LABEL = {
  NONE: 'Không leo thang',
  DIRECT_MANAGER: 'Quản lý trực tiếp của người duyệt',
  USER: 'Người cụ thể',
} as const;
export type EscalationType = keyof typeof ESCALATION_TYPE_LABEL;
export const ESCALATION_TYPE_OPTIONS = optionsOf(ESCALATION_TYPE_LABEL);

export const CONDITION_MATCH_LABEL = {
  ALL: 'Đúng tất cả điều kiện',
  ANY: 'Đúng một trong các điều kiện',
} as const;
export type ConditionMatch = keyof typeof CONDITION_MATCH_LABEL;
export const CONDITION_MATCH_OPTIONS = optionsOf(CONDITION_MATCH_LABEL);

export const CONDITION_TYPE_LABEL = {
  TOTAL_ABOVE: 'Tổng tiền lớn hơn',
  DISCOUNT_ABOVE: 'Chiết khấu lớn hơn',
  OVER_CREDIT: 'Đơn có cờ vượt hạn mức công nợ',
  LOW_STOCK: 'Đơn có cờ thiếu tồn kho',
  PRODUCT_GROUP: 'Có sản phẩm thuộc nhóm',
  DEALER_TIER: 'Loại đại lý là',
} as const;
export type ConditionType = keyof typeof CONDITION_TYPE_LABEL;
export const CONDITION_TYPE_OPTIONS = optionsOf(CONDITION_TYPE_LABEL);

const AMOUNT_MESSAGE = 'Nhập số tiền là số nguyên, tối đa 1.000 tỷ đồng';

function amountVnd(min: number) {
  return z.coerce
    .number<number>({ error: AMOUNT_MESSAGE })
    .int(AMOUNT_MESSAGE)
    .min(min, min > 0 ? 'Nhập số tiền lớn hơn 0' : AMOUNT_MESSAGE)
    .max(MAX_AMOUNT_VND, AMOUNT_MESSAGE);
}

const PERCENT_MESSAGE = 'Nhập phần trăm từ 0 đến 100';
const percent = z.coerce
  .number<number>({ error: PERCENT_MESSAGE })
  .min(0, PERCENT_MESSAGE)
  .max(100, PERCENT_MESSAGE);

export const stepCondition = z.discriminatedUnion('type', [
  z.object({ type: z.literal('TOTAL_ABOVE'), amountVnd: amountVnd(1) }),
  z.object({ type: z.literal('DISCOUNT_ABOVE'), percent }),
  z.object({ type: z.literal('OVER_CREDIT') }),
  z.object({ type: z.literal('LOW_STOCK') }),
  z.object({
    type: z.literal('PRODUCT_GROUP'),
    productGroup: z
      .string()
      .trim()
      .min(1, 'Vui lòng nhập tên nhóm sản phẩm')
      .max(50, 'Tên nhóm tối đa 50 ký tự'),
  }),
  z.object({ type: z.literal('DEALER_TIER'), dealerTier }),
]);
export type StepCondition = z.infer<typeof stepCondition>;
export const stepConditions = z.array(stepCondition).max(MAX_STEP_CONDITIONS);

export function newStepCondition(type: ConditionType): StepCondition {
  switch (type) {
    case 'TOTAL_ABOVE':
      return { type, amountVnd: 0 };
    case 'DISCOUNT_ABOVE':
      return { type, percent: 0 };
    case 'OVER_CREDIT':
    case 'LOW_STOCK':
      return { type };
    case 'PRODUCT_GROUP':
      return { type, productGroup: '' };
    case 'DEALER_TIER':
      return { type, dealerTier: 'LEVEL_1' };
  }
}

export function describeCondition(condition: StepCondition): string {
  const label = CONDITION_TYPE_LABEL[condition.type];
  switch (condition.type) {
    case 'TOTAL_ABOVE':
      return `${label} ${formatVnd(condition.amountVnd)}`;
    case 'DISCOUNT_ABOVE':
      return `${label} ${condition.percent}%`;
    case 'PRODUCT_GROUP':
      return `${label} ${condition.productGroup}`;
    case 'DEALER_TIER':
      return DEALER_TIER_LABEL[condition.dealerTier];
    case 'OVER_CREDIT':
    case 'LOW_STOCK':
      return label;
  }
}

const uuidOrNull = z.uuid({ error: 'Lựa chọn không hợp lệ' }).nullable();

export const approvalStepInput = z
  .object({
    name: z.string().trim().min(2, 'Tên bước cần ít nhất 2 ký tự').max(100, 'Tên bước tối đa 100'),
    approverType: z.enum(['ROLE', 'JOB_TITLE', 'USER']),
    approverRoleId: uuidOrNull,
    approverJobTitle: z.string().trim().max(100).nullable(),
    approverUserId: uuidOrNull,
    approvalMode: z.enum(['ANY', 'ALL']),
    slaHours: integerInRange(1, MAX_SLA_HOURS),
    escalationType: z.enum(['NONE', 'DIRECT_MANAGER', 'USER']),
    escalationUserId: uuidOrNull,
    skipBelowVnd: amountVnd(0),
    conditionMatch: z.enum(['ALL', 'ANY']),
    conditions: stepConditions,
  })
  .superRefine((step, context) => {
    const require = (path: string, value: string | null, message: string) => {
      if (!value) context.addIssue({ code: 'custom', path: [path], message });
    };
    if (step.approverType === 'ROLE') {
      require('approverRoleId', step.approverRoleId, 'Vui lòng chọn vai trò');
    }
    if (step.approverType === 'JOB_TITLE') {
      require('approverJobTitle', step.approverJobTitle, 'Vui lòng chọn chức danh');
    }
    if (step.approverType === 'USER') {
      require('approverUserId', step.approverUserId, 'Vui lòng chọn người duyệt');
    }
    if (step.escalationType === 'USER') {
      require('escalationUserId', step.escalationUserId, 'Vui lòng chọn người nhận leo thang');
    }
  })
  // Doi kieu nguoi duyet tren form van con gia tri cu cua kieu truoc, khong duoc luu lai.
  .transform((step) => ({
    ...step,
    approverRoleId: step.approverType === 'ROLE' ? step.approverRoleId : null,
    approverJobTitle: step.approverType === 'JOB_TITLE' ? step.approverJobTitle : null,
    approverUserId: step.approverType === 'USER' ? step.approverUserId : null,
    escalationUserId: step.escalationType === 'USER' ? step.escalationUserId : null,
  }));
export type ApprovalStepInput = z.infer<typeof approvalStepInput>;

export function newApprovalStep(): ApprovalStepInput {
  return {
    name: '',
    approverType: 'ROLE',
    approverRoleId: null,
    approverJobTitle: null,
    approverUserId: null,
    approvalMode: 'ANY',
    slaHours: DEFAULT_SLA_HOURS,
    escalationType: 'NONE',
    escalationUserId: null,
    skipBelowVnd: 0,
    conditionMatch: 'ALL',
    conditions: [],
  };
}

const workflowSteps = z
  .array(approvalStepInput)
  .min(1, 'Quy trình cần ít nhất một bước')
  .max(MAX_WORKFLOW_STEPS, `Quy trình tối đa ${MAX_WORKFLOW_STEPS} bước`);

export const publishWorkflowInput = z.object({
  orgUnitId: z.uuid(),
  // Phien ban dang mo tren man hinh, null la don vi chua co quy trinh rieng.
  expectedVersion: z.number().int().positive().nullable(),
  steps: workflowSteps,
});
export type PublishWorkflowInput = z.infer<typeof publishWorkflowInput>;

export const inheritWorkflowInput = z.object({
  orgUnitId: z.uuid(),
  expectedVersion: z.number().int().positive(),
});
export type InheritWorkflowInput = z.infer<typeof inheritWorkflowInput>;

export const previewApprovalForm = z.object({
  orgUnitId: z.uuid({ error: 'Vui lòng chọn đơn vị' }),
  creatorId: uuidOrNull,
  totalVnd: amountVnd(0),
  discountPercent: percent,
  isOverCredit: z.boolean(),
  isLowStock: z.boolean(),
  productGroup: z.string().trim().max(50, 'Tên nhóm tối đa 50 ký tự'),
  dealerTier: dealerTier.nullable(),
});
export type PreviewApprovalForm = z.infer<typeof previewApprovalForm>;

export const previewApprovalInput = previewApprovalForm.extend({
  // Ban dang sua tren man hinh, xem truoc duoc khi chua luu thanh phien ban moi.
  draft: z.object({ orgUnitId: z.uuid(), steps: workflowSteps }).nullable(),
});
export type PreviewApprovalInput = z.infer<typeof previewApprovalInput>;

export type StepView = {
  input: ApprovalStepInput;
  approverLabel: string;
  escalationLabel: string | null;
};

function approverText({ input, approverLabel }: StepView): string {
  switch (input.approverType) {
    case 'ROLE':
      return `Vai trò ${approverLabel} trong đơn vị người tạo`;
    case 'JOB_TITLE':
      return `Chức danh ${approverLabel} ở đơn vị cấp trên`;
    case 'USER':
      return approverLabel;
  }
}

export function stepDetailLines(view: StepView): string[] {
  const { input, escalationLabel } = view;
  const escalation =
    input.escalationType === 'NONE'
      ? 'không leo thang'
      : `quá hạn leo thang lên ${escalationLabel ?? 'quản lý trực tiếp của người duyệt'}`;
  const conditions = input.conditions.map(describeCondition);
  return [
    `Người duyệt: ${approverText(view)}`,
    `Kiểu duyệt: ${APPROVAL_MODE_LABEL[input.approvalMode]}`,
    `SLA ${input.slaHours} giờ, ${escalation}`,
    ...(input.skipBelowVnd > 0 ? [`Tự duyệt khi đơn dưới ${formatVnd(input.skipBelowVnd)}`] : []),
    conditions.length === 0
      ? 'Bước luôn chạy'
      : `Chỉ chạy khi: ${conditions.join(input.conditionMatch === 'ALL' ? ' và ' : ' hoặc ')}`,
  ];
}

export function summarizeSteps(views: readonly StepView[]): string {
  return views
    .map((view, index) => `${index + 1}. ${view.input.name}: ${stepDetailLines(view).join(', ')}`)
    .join('; ');
}

export type WorkflowSource = 'OWN' | 'INHERITED' | 'NONE';

export type WorkflowUnitRow = {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
  source: WorkflowSource;
  sourceUnitName: string | null;
  version: number | null;
  stepCount: number;
};

export type WorkflowVersionView = {
  version: number;
  isActive: boolean;
  createdAt: string;
  createdByName: string;
  steps: StepView[];
};

export type WorkflowDetail = {
  unit: { id: string; code: string; name: string; isRoot: boolean };
  canManage: boolean;
  own: { version: number; steps: StepView[] } | null;
  inherited: { sourceUnitName: string; version: number; steps: StepView[] } | null;
  history: WorkflowVersionView[];
};

export type SelectOption = { value: string; label: string };

export type WorkflowFormOptions = {
  roles: SelectOption[];
  users: SelectOption[];
  jobTitles: SelectOption[];
  units: SelectOption[];
};

export const delegationStatus = ['SCHEDULED', 'ACTIVE', 'EXPIRED', 'REVOKED'] as const;
export type DelegationStatus = (typeof delegationStatus)[number];

export const DELEGATION_STATUS_LABEL: Record<DelegationStatus, string> = {
  SCHEDULED: 'Sắp hiệu lực',
  ACTIVE: 'Đang hiệu lực',
  EXPIRED: 'Đã hết hạn',
  REVOKED: 'Đã thu hồi',
};

export function resolveDelegationStatus(
  delegation: { startDate: string; endDate: string; isRevoked: boolean },
  today: string,
): DelegationStatus {
  if (delegation.isRevoked) return 'REVOKED';
  if (today < delegation.startDate) return 'SCHEDULED';
  return today > delegation.endDate ? 'EXPIRED' : 'ACTIVE';
}

function delegationDate(message: string) {
  return z.string().refine((value) => parseDisplayDate(value) !== null, message);
}

export const createDelegationInput = z
  .object({
    delegatorId: z.uuid({ error: 'Vui lòng chọn người vắng' }),
    delegateId: z.uuid({ error: 'Vui lòng chọn người nhận uỷ quyền' }),
    startDate: delegationDate('Từ ngày không hợp lệ, cần dạng dd/mm/yyyy'),
    endDate: delegationDate('Đến ngày không hợp lệ, cần dạng dd/mm/yyyy'),
    reason: z.string().trim().min(2, 'Vui lòng nhập lý do').max(200, 'Lý do tối đa 200 ký tự'),
  })
  .superRefine(({ delegatorId, delegateId, startDate, endDate }, context) => {
    if (delegatorId === delegateId) {
      context.addIssue({
        code: 'custom',
        path: ['delegateId'],
        message: 'Người nhận uỷ quyền phải khác người vắng',
      });
    }
    if (startDate > endDate) {
      context.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: 'Đến ngày phải sau hoặc bằng Từ ngày',
      });
    }
  });
export type CreateDelegationInput = z.infer<typeof createDelegationInput>;

export const revokeDelegationInput = z.object({ id: z.uuid() });

export const delegationRow = z.object({
  id: z.uuid(),
  delegatorName: z.string(),
  delegateName: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string(),
  status: z.enum(delegationStatus),
});
export type DelegationRow = z.infer<typeof delegationRow>;

export const listDelegationsResult = pageResult(delegationRow);
export type ListDelegationsResult = z.infer<typeof listDelegationsResult>;

const DELEGATIONS_PAGE_SIZE = 20;

export const workflowsUrlParams = z
  .object({
    tab: z.enum(['uy-quyen']).optional().catch(undefined),
    trang: z.coerce.number().int().positive().max(1_000_000).catch(1),
  })
  .transform((url) => ({
    tab: url.tab ?? ('don-vi' as const),
    page: url.trang,
    pageSize: DELEGATIONS_PAGE_SIZE,
  }));

export function delegationAuditLabel(delegatorName: string, delegateName: string): string {
  return `${delegatorName} uỷ quyền cho ${delegateName}`;
}

export function delegationPeriodText(startDate: string, endDate: string): string {
  return `${formatDateOnly(startDate)} đến ${formatDateOnly(endDate)}`;
}
