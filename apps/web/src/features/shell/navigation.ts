import {
  CalendarDays,
  ChartColumn,
  FileChartColumn,
  Inbox,
  LayoutDashboard,
  MapPin,
  MessageSquareText,
  Network,
  Plug,
  Route,
  ScrollText,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  Target,
  Ticket,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { DepartmentSlug } from '@dms/contracts/departments';

export type NavItem = { label: string; href: string; icon: LucideIcon };
export type NavGroup = { label?: string; items: NavItem[] };

export const DEPARTMENT_NAV: Record<DepartmentSlug, NavGroup[]> = {
  'kinh-doanh': [
    {
      label: 'Tổng quan',
      items: [{ label: 'Dashboard', href: '/kinh-doanh/dashboard', icon: LayoutDashboard }],
    },
    {
      label: 'Đối tác',
      items: [
        { label: 'Chỉ tiêu', href: '/kinh-doanh/chi-tieu', icon: Target },
        { label: 'Đại lý', href: '/kinh-doanh/dai-ly', icon: Store },
        { label: 'Khách hàng', href: '/kinh-doanh/khach-hang', icon: Users },
      ],
    },
    {
      label: 'Thị trường',
      items: [
        { label: 'Tuyến viếng thăm', href: '/kinh-doanh/tuyen-vieng-tham', icon: Route },
        { label: 'Check-in', href: '/kinh-doanh/check-in', icon: MapPin },
      ],
    },
    {
      label: 'Đối soát',
      items: [{ label: 'Báo cáo', href: '/kinh-doanh/bao-cao', icon: FileChartColumn }],
    },
  ],
  cskh: [
    {
      items: [
        { label: 'Hộp thư', href: '/cskh/hop-thu', icon: Inbox },
        { label: 'Phiếu tiếp nhận', href: '/cskh/phieu', icon: Ticket },
        { label: 'Khách hàng', href: '/cskh/khach-hang', icon: Users },
        { label: 'Mẫu trả lời', href: '/cskh/mau-tra-loi', icon: MessageSquareText },
        { label: 'Dashboard', href: '/cskh/dashboard', icon: ChartColumn },
      ],
    },
  ],
  'quan-tri': [
    {
      label: 'Người dùng',
      items: [
        { label: 'Tài khoản', href: '/quan-tri/tai-khoan', icon: UserCog },
        { label: 'Vai trò và quyền', href: '/quan-tri/vai-tro', icon: ShieldCheck },
        { label: 'Cơ cấu tổ chức', href: '/quan-tri/co-cau-to-chuc', icon: Network },
      ],
    },
    {
      label: 'Danh mục',
      items: [{ label: 'Đại lý', href: '/quan-tri/dai-ly', icon: Store }],
    },
    {
      label: 'Quy định',
      items: [
        { label: 'Lịch vụ', href: '/quan-tri/lich-vu', icon: CalendarDays },
        { label: 'Tham số', href: '/quan-tri/tham-so', icon: SlidersHorizontal },
      ],
    },
    {
      label: 'Hệ thống',
      items: [
        { label: 'Kết nối', href: '/quan-tri/ket-noi', icon: Plug },
        { label: 'Nhật ký', href: '/quan-tri/nhat-ky', icon: ScrollText },
      ],
    },
  ],
};

export function findNavItem(slug: DepartmentSlug, href: string): NavItem | undefined {
  return DEPARTMENT_NAV[slug].flatMap((group) => group.items).find((item) => item.href === href);
}
