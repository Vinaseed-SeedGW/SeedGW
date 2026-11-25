import { Bell } from 'lucide-react';
import Link from 'next/link';
import { formatNumber } from '@seedgw/contracts/format';
import { getUnreadNotificationCount } from '@/server/queries/notifications';

/** D4: chuông trên thanh trên, số đỏ là thông báo chưa đọc. */
export async function NotificationBell() {
  const unread = await getUnreadNotificationCount();
  const label = unread > 0 ? `Thông báo, ${unread} chưa đọc` : 'Thông báo';
  return (
    <Link
      href="/thong-bao"
      aria-label={label}
      className="relative inline-flex size-9 flex-none items-center justify-center rounded-md text-text-muted hover:bg-brand-soft hover:text-brand focus-visible:outline-2 focus-visible:outline-brand"
    >
      <Bell size={20} aria-hidden />
      {unread > 0 ? (
        <span className="absolute -top-1 -right-1 inline-flex min-w-5 items-center justify-center rounded-full bg-danger px-1 text-xs leading-5 font-bold text-primary-foreground tabular-nums">
          {unread > 99 ? '99+' : formatNumber(unread)}
        </span>
      ) : null}
    </Link>
  );
}
