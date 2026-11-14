export const DEPARTMENTS = [
  {
    slug: 'kinh-doanh',
    name: 'Kinh doanh',
    description: 'Check-in, đại lý, khách hàng, tuyến, báo cáo',
  },
  {
    slug: 'quan-tri',
    name: 'Quản trị',
    description: 'Hỗ trợ, tài khoản, cơ cấu tổ chức, danh mục, tham số',
  },
] as const;

export type DepartmentSlug = (typeof DEPARTMENTS)[number]['slug'];
