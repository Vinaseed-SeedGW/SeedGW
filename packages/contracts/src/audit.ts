import { z } from 'zod';
import { pageResult } from './common';
import { parseDisplayDate } from './format';
import { SETTING_LABEL } from './settings';

export type AuditValue = string | number | boolean | null;
export type AuditChanges = Record<string, { before: AuditValue; after: AuditValue }>;

export function auditChanges(
  before: Record<string, AuditValue>,
  after: Record<string, AuditValue>,
): AuditChanges {
  const changes: AuditChanges = {};
  for (const field of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const previous = before[field] ?? null;
    const next = after[field] ?? null;
    if (previous !== next) changes[field] = { before: previous, after: next };
  }
  return changes;
}

export const AUDIT_ACTION_LABEL = {
  'user.create': 'Tạo tài khoản',
  'user.import': 'Nhập tài khoản từ Excel',
  'user.update': 'Sửa tài khoản',
  'user.lock': 'Khoá tài khoản',
  'user.unlock': 'Mở khoá tài khoản',
  'user.reset-password': 'Đặt lại mật khẩu',
  'user.change-password': 'Đổi mật khẩu',
  'user.impersonate-start': 'Bắt đầu đăng nhập thay',
  'user.impersonate-stop': 'Kết thúc đăng nhập thay',
  'user.device-approve': 'Duyệt thiết bị',
  'user.device-revoke': 'Thu hồi thiết bị',
  'org-unit.create': 'Tạo đơn vị',
  'org-unit.update': 'Sửa đơn vị',
  'org-unit.move': 'Chuyển đơn vị',
  'org-unit.delete': 'Xoá đơn vị',
  'org-unit.assign': 'Đổi Trưởng đơn vị',
  'role.create': 'Tạo vai trò',
  'role.update': 'Sửa quyền của vai trò',
  'role.delete': 'Xoá vai trò',
  'setting.update': 'Sửa tham số',
  'code-sequence.update': 'Sửa dải mã',
  'workflow.publish': 'Tạo phiên bản quy trình duyệt',
  'workflow.inherit': 'Chuyển quy trình về kế thừa',
  'delegation.create': 'Tạo uỷ quyền',
  'delegation.revoke': 'Thu hồi uỷ quyền',
} as const;
export type AuditAction = keyof typeof AUDIT_ACTION_LABEL;

export const AUDIT_ENTITY_LABEL = {
  User: 'Tài khoản',
  OrgUnit: 'Đơn vị',
  Role: 'Vai trò',
  SystemSetting: 'Tham số',
  CodeSequence: 'Dải mã',
  ApprovalWorkflow: 'Quy trình duyệt',
  Delegation: 'Uỷ quyền',
} as const;
export type AuditEntityType = keyof typeof AUDIT_ENTITY_LABEL;

const AUDIT_ENTITY_TYPES = Object.keys(AUDIT_ENTITY_LABEL) as [
  AuditEntityType,
  ...AuditEntityType[],
];

export const AUDIT_ENTITY_OPTIONS = AUDIT_ENTITY_TYPES.map((value) => ({
  value,
  label: AUDIT_ENTITY_LABEL[value],
}));

export const AUDIT_FIELD_LABEL: Record<string, string> = {
  fullName: 'Họ tên',
  isActive: 'Đang hoạt động',
  phone: 'Số điện thoại',
  email: 'Email',
  jobTitle: 'Chức danh',
  hiredAt: 'Ngày vào làm',
  orgUnit: 'Đơn vị',
  directManager: 'Quản lý trực tiếp',
  roles: 'Vai trò',
  device: 'Thiết bị',
  code: 'Mã',
  name: 'Tên',
  parent: 'Đơn vị cha',
  manager: 'Trưởng đơn vị',
  dataScope: 'Phạm vi dữ liệu',
  permissionsAdded: 'Thêm quyền',
  permissionsRemoved: 'Bỏ quyền',
  prefix: 'Tiền tố',
  digits: 'Số chữ số',
  rangeStart: 'Số đầu dải',
  rangeEnd: 'Số cuối dải',
  version: 'Phiên bản',
  steps: 'Các bước',
  delegator: 'Người vắng',
  delegate: 'Người nhận uỷ quyền',
  period: 'Thời gian',
  reason: 'Lý do',
  status: 'Trạng thái',
  ...SETTING_LABEL,
};

export function formatAuditValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '(trống)';
  if (typeof value === 'boolean') return value ? 'Có' : 'Không';
  return String(value);
}

export const auditLogSummary = z.object({
  id: z.uuid(),
  createdAt: z.iso.datetime(),
  actorName: z.string().nullable(),
  impersonatorName: z.string().nullable(),
  actionLabel: z.string(),
  entityTypeLabel: z.string(),
  entityLabel: z.string(),
  changes: z.array(z.object({ label: z.string(), before: z.string(), after: z.string() })),
  ip: z.string().nullable(),
});
export type AuditLogSummary = z.infer<typeof auditLogSummary>;

export const listAuditLogsResult = pageResult(auditLogSummary);
export type ListAuditLogsResult = z.infer<typeof listAuditLogsResult>;

const AUDIT_PAGE_SIZE = 20;

const auditDateParam = z
  .string()
  .transform((value) => parseDisplayDate(value) ?? undefined)
  .optional()
  .catch(undefined);

// Khoang ngay nhap nguoc thi tu doi cho, ngay sai thi bo qua.
export const auditUrlParams = z
  .object({
    q: z.string().trim().max(100).optional().catch(undefined),
    'doi-tuong': z.enum(AUDIT_ENTITY_TYPES).optional().catch(undefined),
    'tu-ngay': auditDateParam,
    'den-ngay': auditDateParam,
    trang: z.coerce.number().int().positive().max(1_000_000).catch(1),
  })
  .transform((url) => {
    const start = url['tu-ngay'];
    const end = url['den-ngay'];
    const isReversed = start !== undefined && end !== undefined && start > end;
    return {
      q: url.q || undefined,
      entityType: url['doi-tuong'],
      from: isReversed ? end : start,
      to: isReversed ? start : end,
      page: url.trang,
      pageSize: AUDIT_PAGE_SIZE,
    };
  });
export type ListAuditLogsInput = z.infer<typeof auditUrlParams>;
