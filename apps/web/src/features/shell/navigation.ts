import {
  CalendarCheck,
  CalendarDays,
  ChartColumn,
  ClipboardCheck,
  FileChartColumn,
  Inbox,
  LayoutDashboard,
  MapPin,
  MessageSquareText,
  Network,
  Package,
  Plug,
  RefreshCw,
  Route,
  ScrollText,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  Store,
  Tags,
  Target,
  Ticket,
  UserCog,
  Users,
  Warehouse,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import type { DepartmentSlug } from '@dms/contracts/departments';

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
      label: 'Bán hàng',
      items: [
        { label: 'Đơn hàng', href: '/kinh-doanh/don-hang', icon: ShoppingCart },
        { label: 'Tồn kho', href: '/kinh-doanh/ton-kho', icon: Warehouse },
        { label: 'Chỉ tiêu', href: '/kinh-doanh/chi-tieu', icon: Target },
      ],
    },
    {
      label: 'Đối tác',
      items: [
        { label: 'Đại lý', href: '/kinh-doanh/dai-ly', icon: Store },
        { label: 'Khách hàng', href: '/kinh-doanh/khach-hang', icon: Users },
      ],
    },
    {
      label: 'Thị trường',
      items: [
        { label: 'Tuyến viếng thăm', href: '/kinh-doanh/tuyen-vieng-tham', icon: Route },
        { label: 'Check-in', href: '/kinh-doanh/check-in', icon: MapPin },
        { label: 'Chấm công', href: '/kinh-doanh/cham-cong', icon: CalendarCheck },
      ],
    },
    {
      label: 'Đối soát',
      items: [
        { label: 'Đồng bộ FAST', href: '/kinh-doanh/dong-bo-fast', icon: RefreshCw },
        { label: 'Báo cáo', href: '/kinh-doanh/bao-cao', icon: FileChartColumn },
      ],
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
      items: [
        { label: 'Sản phẩm', href: '/quan-tri/san-pham', icon: Package },
        { label: 'Kho', href: '/quan-tri/kho', icon: Warehouse },
        { label: 'Đại lý', href: '/quan-tri/dai-ly', icon: Store },
        { label: 'Bảng giá', href: '/quan-tri/bang-gia', icon: Tags },
      ],
    },
    {
      label: 'Quy định',
      items: [
        { label: 'Quy trình duyệt', href: '/quan-tri/quy-trinh-duyet', icon: Workflow },
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
