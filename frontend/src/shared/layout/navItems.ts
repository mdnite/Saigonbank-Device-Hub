import {
  ArrowLeftRight,
  ClipboardCheck,
  ClipboardList,
  LayoutDashboard,
  type LucideIcon,
  Package,
  Settings,
  Users,
} from 'lucide-react';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Chỉ hiện với Quản trị viên. */
  adminOnly?: boolean;
  /** Chỉ hiện với Quản trị viên hoặc Trưởng phòng Kỹ thuật. */
  orderAccessOnly?: boolean;
}

/** Primary navigation — Vietnamese labels, matches the canonical sidebar. */
export const PRIMARY_NAV: NavItem[] = [
  { label: 'Tổng quan', to: '/dashboard', icon: LayoutDashboard },
  { label: 'Người dùng', to: '/users', icon: Users, adminOnly: true },
  { label: 'Tài sản', to: '/devices', icon: Package },
  { label: 'Điều chuyển', to: '/transfers', icon: ArrowLeftRight },
  { label: 'Cấp phát - Thu hồi', to: '/allocation', icon: ClipboardList, orderAccessOnly: true },
  { label: 'Kiểm kê', to: '/audit', icon: ClipboardCheck },
];

export const SETTINGS_NAV: NavItem = { label: 'Cài đặt', to: '/settings', icon: Settings };
