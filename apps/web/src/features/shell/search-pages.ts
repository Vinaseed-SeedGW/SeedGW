import { canAccessPath } from '@seedgw/contracts/access';
import { DEPARTMENTS } from '@seedgw/contracts/departments';
import type { SearchPage } from '@seedgw/contracts/search';
import { DEPARTMENT_NAV } from './navigation';

const PROPOSALS_PAGE: SearchPage = {
  href: '/kinh-doanh/dai-ly/de-xuat',
  label: 'Đại lý đề xuất',
  section: 'Kinh doanh',
};

/** Các trang người dùng mở được, để ô tìm nhanh gợi ý cả trang lẫn dữ liệu (D3). */
export function listSearchPages(permissions: ReadonlySet<string>): SearchPage[] {
  const pages: SearchPage[] = [{ href: '/hub', label: 'Hub', section: 'Chung' }];
  if (canAccessPath(permissions, '/tong-quan')) {
    pages.push({ href: '/tong-quan', label: 'Tổng quan điều hành', section: 'Chung' });
  }
  for (const department of DEPARTMENTS) {
    for (const group of DEPARTMENT_NAV[department.slug]) {
      for (const item of group.items) {
        if (canAccessPath(permissions, item.href)) {
          pages.push({ href: item.href, label: item.label, section: department.name });
        }
      }
    }
  }
  // Trang con không có trên menu nhưng hay cần mở nhanh.
  if (canAccessPath(permissions, PROPOSALS_PAGE.href)) pages.push(PROPOSALS_PAGE);
  return pages;
}
