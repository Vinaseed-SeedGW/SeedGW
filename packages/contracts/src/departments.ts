export const DEPARTMENTS = [
  {
    slug: 'kinh-doanh',
    name: 'Kinh doanh',
    description: 'Check-in, đại lý, khách hàng, tuyến, báo cáo',
  },
  {
    slug: 'trao-doi',
    name: 'Trao đổi',
    description: 'Hỏi đáp, báo lỗi, góp ý gửi quản trị',
  },
  {
    slug: 'quan-tri',
    name: 'Quản trị',
    description: 'Tài khoản, cơ cấu tổ chức, danh mục, tham số',
  },
] as const;

export type DepartmentSlug = (typeof DEPARTMENTS)[number]['slug'];
