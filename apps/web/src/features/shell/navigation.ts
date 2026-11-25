import {
  Bug,
  FileCheck,
  CalendarDays,
  ClipboardCheck,
  Combine,
  FileChartColumn,
  HousePlus,
  LayoutDashboard,
  LifeBuoy,
  Map as MapIcon,
  MapPin,
  MapPinCheck,
  Network,
  PhoneOff,
  Plug,
  Route,
  ScrollText,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  Target,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { DepartmentSlug } from '@seedgw/contracts/departments';

export type NavItem = { label: string; href: string; icon: LucideIcon };
export type NavGroup = { label?: string; items: NavItem[] };

export const DEPARTMENT_NAV: Record<DepartmentSlug, NavGroup[]> = {
  'kinh-doanh': [
    {
      label: 'Tổng quan',
      items: [
        { label: 'Dashboard', href: '/kinh-doanh/dashboard', icon: LayoutDashboard },
        { label: 'Cần duyệt', href: '/kinh-doanh/can-duyet', icon: ClipboardCheck },
      ],
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
  'quan-tri': [
    {
      label: 'Tiếp nhận',
      items: [{ label: 'Hỗ trợ', href: '/quan-tri/ho-tro', icon: LifeBuoy }],
    },
    {
      label: 'Người dùng',
      items: [
        { label: 'Tài khoản', href: '/quan-tri/tai-khoan', icon: UserCog },
        { label: 'Vai trò và quyền', href: '/quan-tri/vai-tro', icon: ShieldCheck },
        { label: 'Cơ cấu tổ chức', href: '/quan-tri/co-cau-to-chuc', icon: Network },
        { label: 'Đồng ý dữ liệu', href: '/quan-tri/dong-y', icon: FileCheck },
      ],
    },
    {
      label: 'Danh mục',
      items: [
        { label: 'Đại lý', href: '/quan-tri/dai-ly', icon: Store },
        { label: 'Đại lý mới', href: '/quan-tri/dai-ly/dai-ly-moi', icon: HousePlus },
        { label: 'Duyệt toạ độ', href: '/quan-tri/dai-ly/duyet-toa-do', icon: MapPinCheck },
        { label: 'Đại lý trùng', href: '/quan-tri/dai-ly/trung', icon: Combine },
        { label: 'Số điện thoại sai', href: '/quan-tri/dai-ly/so-dien-thoai', icon: PhoneOff },
      ],
    },
    {
      label: 'Quy định',
      items: [
        { label: 'Lịch vụ', href: '/quan-tri/lich-vu', icon: CalendarDays },
        { label: 'Vùng và tỉnh', href: '/quan-tri/vung-tinh', icon: MapIcon },
        { label: 'Tham số', href: '/quan-tri/tham-so', icon: SlidersHorizontal },
      ],
    },
    {
      label: 'Hệ thống',
      items: [
        { label: 'Kết nối', href: '/quan-tri/ket-noi', icon: Plug },
        { label: 'Nhật ký', href: '/quan-tri/nhat-ky', icon: ScrollText },
        { label: 'Lỗi hệ thống', href: '/quan-tri/loi-he-thong', icon: Bug },
      ],
    },
  ],
};

export function findNavItem(slug: DepartmentSlug, href: string): NavItem | undefined {
  return DEPARTMENT_NAV[slug].flatMap((group) => group.items).find((item) => item.href === href);
}
