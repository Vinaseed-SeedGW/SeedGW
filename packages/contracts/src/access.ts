import { z } from 'zod';
import type { DepartmentSlug } from './departments';

export const PERMISSIONS = [
  { code: 'executive.overview.read', name: 'Xem Tổng quan điều hành' },

  { code: 'sales.dashboard.read', name: 'Xem Dashboard Kinh doanh' },
  { code: 'sales.target.read', name: 'Xem Chỉ tiêu' },
  { code: 'sales.dealer.read', name: 'Xem Đại lý' },
  { code: 'sales.dealer.create', name: 'Thêm Đại lý' },
  { code: 'sales.dealer.update', name: 'Sửa Đại lý' },
  { code: 'sales.customer.read', name: 'Xem Khách hàng' },
  { code: 'sales.route.read', name: 'Xem Tuyến viếng thăm' },
  { code: 'sales.check-in.read', name: 'Xem Check-in' },
  { code: 'sales.check-in.create', name: 'Check-in trên app' },
  { code: 'sales.report.read', name: 'Xem Báo cáo' },

  { code: 'support.request.create', name: 'Gửi Yêu cầu hỗ trợ' },
  { code: 'support.request.manage', name: 'Xử lý Yêu cầu hỗ trợ' },

  { code: 'admin.user.read', name: 'Xem Tài khoản' },
  { code: 'admin.user.manage', name: 'Quản lý Tài khoản' },
  { code: 'admin.user.export', name: 'Xuất Excel Tài khoản' },
  { code: 'admin.user.impersonate', name: 'Đăng nhập thay' },
  { code: 'admin.role.read', name: 'Xem Vai trò và quyền' },
  { code: 'admin.role.manage', name: 'Quản lý Vai trò và quyền' },
  { code: 'admin.org-unit.read', name: 'Xem Cơ cấu tổ chức' },
  { code: 'admin.org-unit.manage', name: 'Quản lý Cơ cấu tổ chức' },
  { code: 'admin.org-unit.assign', name: 'Đổi Trưởng đơn vị' },
  { code: 'admin.dealer.read', name: 'Xem danh mục Đại lý' },
  { code: 'admin.dealer.manage', name: 'Quản lý danh mục Đại lý' },
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
  { path: '/kinh-doanh/bao-cao', permission: 'sales.report.read', department: 'kinh-doanh' },

  { path: '/trao-doi/ho-tro', permission: 'support.request.create', department: 'trao-doi' },

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
  { path: '/quan-tri/dai-ly', permission: 'admin.dealer.read', department: 'quan-tri' },
  {
    path: '/quan-tri/dai-ly/nhap-excel',
    permission: 'admin.dealer.manage',
    department: 'quan-tri',
  },
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
    byRole: { operations: '/kinh-doanh/check-in' },
  },
  'trao-doi': {
    fallback: '/trao-doi/ho-tro',
    byRole: {},
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

// Ba vai tro theo quyet dinh 28 (13/11/2026). Chuc danh ghi o ho so tai khoan, khong tach vai tro.
// Task A3 van cho tao them vai tro tren giao dien neu can.
export const ROLE_PRESETS: readonly RolePreset[] = [
  { code: 'admin', name: 'Quản trị hệ thống', dataScope: 'ALL', permissions: ALL_CODES },
  {
    code: 'operations',
    name: 'Quản trị đơn vị',
    dataScope: 'ORG_UNIT_TREE',
    permissions: [
      ...codesInModule('sales'),
      ...codesInModule('support'),
      'admin.user.read',
      'admin.user.manage',
      'admin.user.export',
      'admin.org-unit.read',
      'admin.org-unit.assign',
      'admin.dealer.read',
    ],
  },
  {
    code: 'staff',
    name: 'Cán bộ nhân viên',
    dataScope: 'OWN',
    permissions: [
      'sales.dashboard.read',
      'sales.target.read',
      'sales.dealer.read',
      'sales.dealer.create',
      'sales.dealer.update',
      'sales.customer.read',
      'sales.route.read',
      'sales.check-in.read',
      'sales.check-in.create',
      'support.request.create',
    ],
  },
];
