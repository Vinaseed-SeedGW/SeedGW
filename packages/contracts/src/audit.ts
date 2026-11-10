import { z } from 'zod';
import { pageResult } from './common';

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
} as const;
export type AuditAction = keyof typeof AUDIT_ACTION_LABEL;

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
  entityLabel: z.string(),
  changes: z.array(z.object({ label: z.string(), before: z.string(), after: z.string() })),
  ip: z.string().nullable(),
});
export type AuditLogSummary = z.infer<typeof auditLogSummary>;

export const listAuditLogsResult = pageResult(auditLogSummary);
export type ListAuditLogsResult = z.infer<typeof listAuditLogsResult>;

const AUDIT_PAGE_SIZE = 20;

export const auditUrlParams = z
  .object({ trang: z.coerce.number().int().positive().max(1_000_000).catch(1) })
  .transform((url) => ({ page: url.trang, pageSize: AUDIT_PAGE_SIZE }));
export type ListAuditLogsInput = z.infer<typeof auditUrlParams>;
