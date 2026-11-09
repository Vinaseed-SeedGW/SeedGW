export const DEPARTMENTS = [
  {
    slug: 'kinh-doanh',
    name: 'Kinh doanh',
    description: 'Đơn hàng, đại lý, tuyến, chấm công',
  },
  {
    slug: 'cskh',
    name: 'CSKH',
    description: 'Hộp thư Zalo, phiếu tiếp nhận',
  },
  {
    slug: 'quan-tri',
    name: 'Quản trị',
    description: 'Tài khoản, danh mục, quy trình',
  },
] as const;

export type DepartmentSlug = (typeof DEPARTMENTS)[number]['slug'];

// Trang dich khi bam o bo phan, theo INFORMATION_ARCHITECTURE muc 2.
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

export function departmentLanding(slug: DepartmentSlug, roleCodes: readonly string[]): string {
  const { fallback, byRole } = DEPARTMENT_LANDING[slug];
  const matchedRole = roleCodes.find((code) => code in byRole);
  return matchedRole ? (byRole[matchedRole] ?? fallback) : fallback;
}
