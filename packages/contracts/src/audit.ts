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
  'user.device-register': 'Đăng ký thiết bị trên app',
  'check-in.create': 'Check-in trên app',
  'check-in.link-dealer': 'Gắn đại lý cho check-in',
  'consent.accept': 'Đồng ý chia sẻ vị trí',
  'consent.withdraw': 'Rút lại đồng ý chia sẻ vị trí',
  'dealer.import': 'Nhập đại lý từ Excel',
  'dealer.update': 'Sửa đại lý',
  'customer.create': 'Thêm khách hàng',
  'customer.update': 'Sửa khách hàng',
  'dealer.assign': 'Gán nhân viên phụ trách đại lý',
  'dealer.move': 'Đổi đơn vị phụ trách đại lý',
  'dealer.location.approve': 'Duyệt toạ độ đại lý',
  'dealer.location.reject': 'Từ chối toạ độ đại lý',
  'dealer.proposal.approve': 'Duyệt đại lý mới',
  'dealer.proposal.reject': 'Từ chối đề xuất đại lý mới',
  'dealer.proposal.duplicate': 'Đánh dấu đề xuất trùng đại lý có sẵn',
  'dealer.merge': 'Gộp đại lý trùng',
  'dealer.phone-fix': 'Sửa số điện thoại sai dạng',
  'dealer.duplicate-dismiss': 'Đánh dấu không phải đại lý trùng',
  'approval.submit': 'Gửi duyệt phiếu',
  'approval.approve': 'Duyệt phiếu',
  'approval.return': 'Trả lại phiếu',
  'approval.withdraw': 'Rút lại phiếu',
  'approval.reassign': 'Đổi người duyệt phiếu',
  'sales-target.create': 'Tạo chỉ tiêu tháng',
  'sales-target.update': 'Cập nhật chỉ tiêu tháng',
  'sales-target.assign': 'Giao chỉ tiêu tháng',
  'sales-target.unassign': 'Bỏ chỉ tiêu được giao',
  'sales-target.import': 'Nhập chỉ tiêu giao từ Excel',
  'season.create': 'Thêm vụ',
  'season.update': 'Sửa vụ',
  'season.delete': 'Xoá vụ',
  'province.region': 'Đổi vùng của tỉnh',
  'route-plan.create': 'Đăng ký tuyến',
  'route-plan.update': 'Sửa tuyến',
  'support.create': 'Gửi yêu cầu hỗ trợ',
  'support.claim': 'Nhận xử lý yêu cầu hỗ trợ',
  'support.escalate': 'Chuyển lên Quản trị hệ thống',
  'support.status': 'Đổi trạng thái yêu cầu hỗ trợ',
  'support.reopen': 'Mở lại yêu cầu hỗ trợ',
  'org-unit.create': 'Tạo đơn vị',
  'org-unit.update': 'Sửa đơn vị',
  'org-unit.move': 'Chuyển đơn vị',
  'org-unit.delete': 'Xoá đơn vị',
  'org-unit.assign': 'Đổi Trưởng đơn vị',
  'role.create': 'Tạo vai trò',
  'role.update': 'Sửa quyền của vai trò',
  'role.delete': 'Xoá vai trò',
  'setting.update': 'Sửa tham số',
  'connection.update': 'Sửa cấu hình kết nối FAST',
  'connection.sync': 'Bấm đồng bộ FAST ngay',
  'code-sequence.update': 'Sửa dải mã',
  'workflow.publish': 'Tạo phiên bản quy trình duyệt',
  'workflow.inherit': 'Chuyển quy trình về kế thừa',
  'delegation.create': 'Tạo uỷ quyền',
  'delegation.revoke': 'Thu hồi uỷ quyền',
  'shift.create': 'Tạo ca làm việc',
  'shift.update': 'Sửa ca làm việc',
  'shift.delete': 'Xoá ca làm việc',
  'shift-assignment.create': 'Gán ca',
  'shift-assignment.delete': 'Xoá lần gán ca',
  'holiday.create': 'Thêm ngày nghỉ lễ hoặc làm bù',
  'holiday.delete': 'Xoá ngày nghỉ lễ hoặc làm bù',
} as const;
export type AuditAction = keyof typeof AUDIT_ACTION_LABEL;

export const AUDIT_ENTITY_LABEL = {
  User: 'Tài khoản',
  OrgUnit: 'Đơn vị',
  Role: 'Vai trò',
  SystemSetting: 'Tham số',
  IntegrationSetting: 'Kết nối',
  CodeSequence: 'Dải mã',
  ApprovalWorkflow: 'Quy trình duyệt',
  Delegation: 'Uỷ quyền',
  CheckIn: 'Check-in',
  Dealer: 'Đại lý',
  Customer: 'Khách hàng',
  DealerProposal: 'Đề xuất đại lý mới',
  ApprovalRequest: 'Phiếu duyệt',
  SalesTarget: 'Chỉ tiêu tháng',
  Season: 'Lịch vụ',
  Province: 'Tỉnh',
  RoutePlan: 'Tuyến viếng thăm',
  SupportRequest: 'Yêu cầu hỗ trợ',
  Shift: 'Ca làm việc',
  ShiftAssignment: 'Gán ca',
  Holiday: 'Lịch nghỉ',
} as const;
export type AuditEntityType = keyof typeof AUDIT_ENTITY_LABEL;

const AUDIT_ENTITY_TYPES = Object.keys(AUDIT_ENTITY_LABEL) as [
  AuditEntityType,
  ...AuditEntityType[],
];

// Chuc nang Ca lam viec da bo ngay 11/11/2026. Van giu nhan de doc nhat ky cu, nhung khong dua vao bo loc.
const RETIRED_ENTITY_TYPES: ReadonlySet<AuditEntityType> = new Set([
  // Quy trình duyệt và uỷ quyền bỏ ngày 13/11/2026 cùng phần đơn hàng.
  'ApprovalWorkflow',
  'Delegation',
  'Shift',
  'ShiftAssignment',
  'Holiday',
]);

export const AUDIT_ENTITY_OPTIONS = AUDIT_ENTITY_TYPES.filter(
  (value) => !RETIRED_ENTITY_TYPES.has(value),
).map((value) => ({
  value,
  label: AUDIT_ENTITY_LABEL[value],
}));

export const AUDIT_FIELD_LABEL: Record<string, string> = {
  baseUrl: 'Địa chỉ API',
  username: 'Tên đăng nhập API',
  password: 'Mật khẩu API',
  enabled: 'Bật đồng bộ',
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
  level: 'Cấp đại lý',
  ownerName: 'Chủ đại lý',
  ownerPhone: 'Điện thoại chủ đại lý',
  address: 'Địa chỉ',
  province: 'Tỉnh, thành phố',
  location: 'Toạ độ',
  parentDealer: 'Đại lý cấp trên',
  assignedUser: 'Nhân viên phụ trách',
  dealerCount: 'Số đại lý',
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
  supportLevel: 'Cấp xử lý',
  supportType: 'Loại yêu cầu',
  assignee: 'Người nhận xử lý',
  hours: 'Giờ làm',
  breakTime: 'Nghỉ giữa ca',
  lateGraceMinutes: 'Cho phép đi muộn (phút)',
  earlyGraceMinutes: 'Cho phép về sớm (phút)',
  workUnits: 'Số công',
  workWeekdays: 'Ngày làm trong tuần',
  shift: 'Ca',
  effectiveFrom: 'Áp dụng từ ngày',
  date: 'Ngày',
  kind: 'Loại',
  month: 'Tháng',
  visitCountTarget: 'Chỉ tiêu lượt ghé thăm',
  dealerCoverageTarget: 'Chỉ tiêu số đại lý được ghé',
  salesKgTarget: 'Chỉ tiêu Thực bán (kg)',
  approver: 'Người duyệt',
  step: 'Bước',
  note: 'Ghi chú',
  routeKind: 'Kiểu tuyến',
  stops: 'Điểm trong tuyến',
  mergedInto: 'Gộp vào',
  movedData: 'Dữ liệu chuyển sang',
  taxCode: 'Mã số thuế',
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
