export const DEPARTMENTS = [
  {
    slug: 'kinh-doanh',
    name: 'Kinh doanh',
    description: 'Đơn hàng, đại lý, tuyến, chấm công',
  },
  {
    slug: 'cskh',
    name: 'Chăm sóc khách hàng',
    description: 'Hộp thư Zalo, phiếu tiếp nhận',
  },
  {
    slug: 'quan-tri',
    name: 'Quản trị',
    description: 'Tài khoản, danh mục, quy trình',
  },
] as const;

export type DepartmentSlug = (typeof DEPARTMENTS)[number]['slug'];
