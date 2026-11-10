import { z } from 'zod';
import type { DepartmentSlug } from './departments';

export const PERMISSIONS = [
  { code: 'executive.overview.read', name: 'Xem Tổng quan điều hành' },

  { code: 'sales.dashboard.read', name: 'Xem Dashboard Kinh doanh' },
  { code: 'sales.approval.read', name: 'Xem Cần duyệt' },
  { code: 'sales.order.read', name: 'Xem Đơn hàng' },
  { code: 'sales.order.create', name: 'Tạo Đơn hàng' },
  { code: 'sales.order.approve', name: 'Duyệt Đơn hàng' },
  { code: 'sales.inventory.read', name: 'Xem Tồn kho' },
  { code: 'sales.target.read', name: 'Xem Chỉ tiêu' },
  { code: 'sales.dealer.read', name: 'Xem Đại lý' },
  { code: 'sales.dealer.create', name: 'Thêm Đại lý' },
  { code: 'sales.customer.read', name: 'Xem Khách hàng' },
  { code: 'sales.route.read', name: 'Xem Tuyến viếng thăm' },
  { code: 'sales.check-in.read', name: 'Xem Check-in' },
  { code: 'sales.attendance.read', name: 'Xem Chấm công' },
  { code: 'sales.fast-sync.read', name: 'Xem Đồng bộ FAST' },
  { code: 'sales.report.read', name: 'Xem Báo cáo' },

  { code: 'cs.inbox.read', name: 'Xem Hộp thư' },
  { code: 'cs.ticket.read', name: 'Xem Phiếu tiếp nhận' },
  { code: 'cs.ticket.create', name: 'Tạo Phiếu' },
  { code: 'cs.ticket.assign', name: 'Phân công Phiếu' },
  { code: 'cs.customer.read', name: 'Xem Khách hàng CSKH' },
  { code: 'cs.reply-template.read', name: 'Xem Mẫu trả lời' },
  { code: 'cs.dashboard.read', name: 'Xem Dashboard CSKH' },

  { code: 'admin.user.read', name: 'Xem Tài khoản' },
  { code: 'admin.user.manage', name: 'Quản lý Tài khoản' },
  { code: 'admin.user.export', name: 'Xuất Excel Tài khoản' },
  { code: 'admin.user.impersonate', name: 'Đăng nhập thay' },
  { code: 'admin.role.read', name: 'Xem Vai trò và quyền' },
  { code: 'admin.role.manage', name: 'Quản lý Vai trò và quyền' },
  { code: 'admin.org-unit.read', name: 'Xem Cơ cấu tổ chức' },
  { code: 'admin.org-unit.manage', name: 'Quản lý Cơ cấu tổ chức' },
  { code: 'admin.org-unit.assign', name: 'Đổi Trưởng đơn vị' },
  { code: 'admin.product.read', name: 'Xem Sản phẩm' },
  { code: 'admin.warehouse.read', name: 'Xem Kho' },
  { code: 'admin.dealer.read', name: 'Xem danh mục Đại lý' },
  { code: 'admin.price-list.read', name: 'Xem Bảng giá' },
  { code: 'admin.workflow.read', name: 'Xem Quy trình duyệt' },
  { code: 'admin.shift.read', name: 'Xem Ca làm việc' },
  { code: 'admin.season.read', name: 'Xem Lịch vụ' },
  { code: 'admin.setting.read', name: 'Xem Tham số' },
  { code: 'admin.setting.manage', name: 'Sửa Tham số' },
  { code: 'admin.connection.read', name: 'Xem Kết nối' },
  { code: 'admin.audit-log.read', name: 'Xem Nhật ký' },
] as const;

export type PermissionCode = (typeof PERMISSIONS)[number]['code'];

export const SYSTEM_ROLE_CODE = 'admin';

// Chi vai tro Quan tri he thong co hai quyen nay, ma tran khong cho cap cho vai tro khac.
export const RESERVED_PERMISSIONS: readonly PermissionCode[] = [
  'admin.role.manage',
  'admin.user.impersonate',
];

type RouteRule = {
  path: string;
  permission: PermissionCode;
  department: DepartmentSlug | null;
};

// Thu tu theo menu, trang dich du phong la muc dau tien nguoi dung co quyen.
export const ROUTE_RULES: readonly RouteRule[] = [
  { path: '/tong-quan', permission: 'executive.overview.read', department: null },

  { path: '/kinh-doanh/dashboard', permission: 'sales.dashboard.read', department: 'kinh-doanh' },
  { path: '/kinh-doanh/can-duyet', permission: 'sales.approval.read', department: 'kinh-doanh' },
  { path: '/kinh-doanh/don-hang', permission: 'sales.order.read', department: 'kinh-doanh' },
  {
    path: '/kinh-doanh/don-hang/tao-moi',
    permission: 'sales.order.create',
    department: 'kinh-doanh',
  },
  { path: '/kinh-doanh/ton-kho', permission: 'sales.inventory.read', department: 'kinh-doanh' },
  { path: '/kinh-doanh/chi-tieu', permission: 'sales.target.read', department: 'kinh-doanh' },
  { path: '/kinh-doanh/dai-ly', permission: 'sales.dealer.read', department: 'kinh-doanh' },
  {
    path: '/kinh-doanh/dai-ly/tao-moi',
    permission: 'sales.dealer.create',
    department: 'kinh-doanh',
  },
  { path: '/kinh-doanh/khach-hang', permission: 'sales.customer.read', department: 'kinh-doanh' },
  {
    path: '/kinh-doanh/tuyen-vieng-tham',
    permission: 'sales.route.read',
    department: 'kinh-doanh',
  },
  { path: '/kinh-doanh/check-in', permission: 'sales.check-in.read', department: 'kinh-doanh' },
  { path: '/kinh-doanh/cham-cong', permission: 'sales.attendance.read', department: 'kinh-doanh' },
  {
    path: '/kinh-doanh/dong-bo-fast',
    permission: 'sales.fast-sync.read',
    department: 'kinh-doanh',
  },
  { path: '/kinh-doanh/bao-cao', permission: 'sales.report.read', department: 'kinh-doanh' },

  { path: '/cskh/hop-thu', permission: 'cs.inbox.read', department: 'cskh' },
  { path: '/cskh/phieu', permission: 'cs.ticket.read', department: 'cskh' },
  { path: '/cskh/phieu/tao-moi', permission: 'cs.ticket.create', department: 'cskh' },
  { path: '/cskh/khach-hang', permission: 'cs.customer.read', department: 'cskh' },
  { path: '/cskh/mau-tra-loi', permission: 'cs.reply-template.read', department: 'cskh' },
  { path: '/cskh/dashboard', permission: 'cs.dashboard.read', department: 'cskh' },

  { path: '/quan-tri/tai-khoan', permission: 'admin.user.read', department: 'quan-tri' },
  {
    path: '/quan-tri/tai-khoan/tao-moi',
    permission: 'admin.user.manage',
    department: 'quan-tri',
  },
  {
    path: '/quan-tri/tai-khoan/nhap-excel',
    permission: 'admin.user.manage',
    department: 'quan-tri',
  },
  { path: '/quan-tri/vai-tro', permission: 'admin.role.read', department: 'quan-tri' },
  { path: '/quan-tri/co-cau-to-chuc', permission: 'admin.org-unit.read', department: 'quan-tri' },
  { path: '/quan-tri/san-pham', permission: 'admin.product.read', department: 'quan-tri' },
  { path: '/quan-tri/kho', permission: 'admin.warehouse.read', department: 'quan-tri' },
  { path: '/quan-tri/dai-ly', permission: 'admin.dealer.read', department: 'quan-tri' },
  { path: '/quan-tri/bang-gia', permission: 'admin.price-list.read', department: 'quan-tri' },
  { path: '/quan-tri/quy-trinh-duyet', permission: 'admin.workflow.read', department: 'quan-tri' },
  { path: '/quan-tri/ca-lam-viec', permission: 'admin.shift.read', department: 'quan-tri' },
  { path: '/quan-tri/lich-vu', permission: 'admin.season.read', department: 'quan-tri' },
  { path: '/quan-tri/tham-so', permission: 'admin.setting.read', department: 'quan-tri' },
  { path: '/quan-tri/ket-noi', permission: 'admin.connection.read', department: 'quan-tri' },
  { path: '/quan-tri/nhat-ky', permission: 'admin.audit-log.read', department: 'quan-tri' },
];

type PermissionSet = ReadonlySet<string>;

// Trang thao tac khong nam tren menu va khong duoc chon lam trang dich.
export function isActionPath(path: string): boolean {
  return path.endsWith('/tao-moi') || path.endsWith('/nhap-excel');
}

// Quy tac dai nhat duoc uu tien de trang con co the can quyen rieng.
export function permissionForPath(pathname: string): PermissionCode | null {
  let longest: RouteRule | null = null;
  for (const rule of ROUTE_RULES) {
    const matches = pathname === rule.path || pathname.startsWith(`${rule.path}/`);
    if (matches && (!longest || rule.path.length > longest.path.length)) longest = rule;
  }
  return longest?.permission ?? null;
}

export function canAccessPath(permissions: PermissionSet, pathname: string): boolean {
  const permission = permissionForPath(pathname);
  return permission !== null && permissions.has(permission);
}

export function canAccessDepartment(permissions: PermissionSet, slug: DepartmentSlug): boolean {
  return ROUTE_RULES.some((rule) => rule.department === slug && permissions.has(rule.permission));
}

const DEPARTMENT_LANDING: Record<
  DepartmentSlug,
  { fallback: string; byRole: Record<string, string> }
> = {
  'kinh-doanh': {
    fallback: '/kinh-doanh/dashboard',
    byRole: { asm: '/kinh-doanh/can-duyet', 'sales-admin': '/kinh-doanh/don-hang' },
  },
  cskh: {
    fallback: '/cskh/hop-thu',
    byRole: { 'customer-care-lead': '/cskh/phieu', executive: '/cskh/dashboard' },
  },
  'quan-tri': {
    fallback: '/quan-tri/tai-khoan',
    byRole: {},
  },
};

export const FORBIDDEN_PATH = '/403';

// Trang dich theo INFORMATION_ARCHITECTURE muc 2, luon la trang nguoi dung co quyen vao.
export function departmentLanding(
  slug: DepartmentSlug,
  roleCodes: readonly string[],
  permissions: PermissionSet,
): string {
  const { fallback, byRole } = DEPARTMENT_LANDING[slug];
  const preferred = roleCodes.map((code) => byRole[code]).find(Boolean) ?? fallback;
  if (canAccessPath(permissions, preferred)) return preferred;

  const firstAllowed = ROUTE_RULES.find(
    (rule) =>
      rule.department === slug && !isActionPath(rule.path) && permissions.has(rule.permission),
  );
  return firstAllowed?.path ?? FORBIDDEN_PATH;
}

export const dataScope = z.enum(['OWN', 'ORG_UNIT', 'ORG_UNIT_TREE', 'ALL']);
export type DataScope = z.infer<typeof dataScope>;

// Nguoi co nhieu vai tro duoc pham vi rong nhat trong cac vai tro.
export function widestDataScope(scopes: readonly DataScope[]): DataScope {
  const ranked = dataScope.options;
  return scopes.reduce<DataScope>(
    (widest, scope) => (ranked.indexOf(scope) > ranked.indexOf(widest) ? scope : widest),
    'OWN',
  );
}

type ActorAuthority = { permissions: PermissionSet; dataScope: DataScope };
type RoleAuthority = { dataScope: DataScope; permissions: ReadonlyArray<{ code: string }> };

// Chi so quyen quan tri va pham vi: nguoi quan ly tai khoan van gan duoc vai tro nghiep vu minh
// khong co, nhung khong duoc cham toi vai tro co quyen quan tri hoac pham vi rong hon de tranh leo quyen.
export function roleExceedsActor(actor: ActorAuthority, role: RoleAuthority): boolean {
  const ranked = dataScope.options;
  return (
    ranked.indexOf(role.dataScope) > ranked.indexOf(actor.dataScope) ||
    role.permissions.some(({ code }) => code.startsWith('admin.') && !actor.permissions.has(code))
  );
}

export type ScopeContext = {
  dataScope: DataScope;
  userId: string;
  orgUnitId: string | null;
  orgUnitTreeIds: readonly string[];
};

export type ScopeFields = {
  ownerField: string;
  orgUnitField: string;
};

// Truong dang user.orgUnitId duoc doi thanh dieu kien long qua quan he.
function fieldFilter(path: string, value: unknown): Record<string, unknown> {
  return path
    .split('.')
    .reduceRight<unknown>((filter, key) => ({ [key]: filter }), value) as Record<string, unknown>;
}

export function scopeWhere(
  context: ScopeContext,
  { ownerField, orgUnitField }: ScopeFields,
): Record<string, unknown> {
  // Nguoi chua gan don vi chi thay du lieu cua chinh minh.
  const ownOnly = { [ownerField]: context.userId };

  switch (context.dataScope) {
    case 'ALL':
      return {};
    case 'ORG_UNIT':
      return context.orgUnitId ? fieldFilter(orgUnitField, context.orgUnitId) : ownOnly;
    case 'ORG_UNIT_TREE':
      return context.orgUnitTreeIds.length > 0
        ? fieldFilter(orgUnitField, { in: [...context.orgUnitTreeIds] })
        : ownOnly;
    case 'OWN':
      return ownOnly;
  }
}

type RolePreset = {
  code: string;
  name: string;
  dataScope: DataScope;
  permissions: readonly PermissionCode[];
};

const ALL_CODES = PERMISSIONS.map((permission) => permission.code);

function codesInModule(moduleName: string): PermissionCode[] {
  return ALL_CODES.filter((code) => code.startsWith(`${moduleName}.`));
}

function without(
  codes: readonly PermissionCode[],
  excluded: readonly PermissionCode[],
): PermissionCode[] {
  return codes.filter((code) => !excluded.includes(code));
}

// Vai tro khoi tao theo DESIGN_BRIEF muc 2. Task A3 cho phep chinh tren giao dien.
export const ROLE_PRESETS: readonly RolePreset[] = [
  { code: 'admin', name: 'Quản trị hệ thống', dataScope: 'ALL', permissions: ALL_CODES },
  {
    code: 'operations',
    name: 'Quản trị đơn vị',
    dataScope: 'ORG_UNIT_TREE',
    permissions: [
      'admin.user.read',
      'admin.user.manage',
      'admin.org-unit.read',
      'admin.org-unit.assign',
    ],
  },
  {
    code: 'sales',
    name: 'Nhân viên kinh doanh',
    dataScope: 'OWN',
    permissions: [
      'sales.dashboard.read',
      'sales.order.read',
      'sales.order.create',
      'sales.inventory.read',
      'sales.target.read',
      'sales.dealer.read',
      'sales.dealer.create',
      'sales.customer.read',
      'sales.route.read',
      'sales.check-in.read',
      'sales.attendance.read',
    ],
  },
  {
    code: 'asm',
    name: 'Quản lý vùng',
    dataScope: 'ORG_UNIT_TREE',
    permissions: without(codesInModule('sales'), ['sales.fast-sync.read']),
  },
  {
    code: 'sales-admin',
    name: 'Sales Admin',
    dataScope: 'ALL',
    permissions: without(codesInModule('sales'), ['sales.approval.read', 'sales.order.approve']),
  },
  {
    code: 'customer-care',
    name: 'Nhân viên CSKH',
    dataScope: 'ORG_UNIT',
    permissions: [
      'cs.inbox.read',
      'cs.ticket.read',
      'cs.ticket.create',
      'cs.customer.read',
      'cs.reply-template.read',
    ],
  },
  {
    code: 'customer-care-lead',
    name: 'Trưởng nhóm CSKH',
    dataScope: 'ORG_UNIT_TREE',
    permissions: codesInModule('cs'),
  },
  {
    code: 'executive',
    name: 'Lãnh đạo',
    dataScope: 'ALL',
    permissions: ['executive.overview.read', 'sales.dashboard.read', 'cs.dashboard.read'],
  },
];
