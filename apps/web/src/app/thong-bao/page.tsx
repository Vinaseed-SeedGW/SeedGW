import { BellOff } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { formatNumber } from '@seedgw/contracts/format';
import { NOTIFICATION_PAGE_SIZE, notificationsUrlParams } from '@seedgw/contracts/notifications';
import { NotificationList } from '@/features/notifications/components/notification-list';
import { HubLayout } from '@/features/shell/components/hub-layout';
import { listSearchPages } from '@/features/shell/search-pages';
import { requireUser } from '@/server/auth/current-user';
import { listMyNotifications } from '@/server/queries/notifications';

export const metadata: Metadata = { title: 'Thông báo' };

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const TAB_CLASS = 'inline-flex h-9 items-center rounded-md px-3 font-bold';

export default async function NotificationsPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const input = notificationsUrlParams.parse(await searchParams);
  const data = await listMyNotifications({ ...input, pageSize: NOTIFICATION_PAGE_SIZE });
  const lastPage = Math.max(1, Math.ceil(data.total / data.pageSize));
  const base = input.unreadOnly ? '/thong-bao?xem=chua-doc&' : '/thong-bao?';

  return (
    <HubLayout userName={user.fullName} searchPages={listSearchPages(user.permissions)}>
      <h1 className="text-2xl font-bold text-brand">Thông báo</h1>
      <p className="mt-1 text-text-muted">
        Thông báo trên app và web, giữ lại để xem sau.{' '}
        {data.unread > 0 ? `${formatNumber(data.unread)} chưa đọc.` : 'Bạn đã đọc hết.'}
      </p>

      <nav className="mt-4 flex gap-2" aria-label="Lọc thông báo">
        <Link
          href="/thong-bao"
          aria-current={input.unreadOnly ? undefined : 'page'}
          className={`${TAB_CLASS} ${input.unreadOnly ? 'text-text-muted hover:bg-brand-soft' : 'bg-brand text-primary-foreground'}`}
        >
          Tất cả
        </Link>
        <Link
          href="/thong-bao?xem=chua-doc"
          aria-current={input.unreadOnly ? 'page' : undefined}
          className={`${TAB_CLASS} ${input.unreadOnly ? 'bg-brand text-primary-foreground' : 'text-text-muted hover:bg-brand-soft'}`}
        >
          Chưa đọc
        </Link>
      </nav>

      {data.items.length === 0 ? (
        <div className="mt-4 flex flex-col items-center gap-2 rounded-lg border border-border bg-surface px-4 py-10 text-center">
          <BellOff size={32} className="text-text-muted" aria-hidden />
          <p className="font-bold">
            {input.unreadOnly ? 'Không có thông báo chưa đọc' : 'Chưa có thông báo nào'}
          </p>
          <p className="text-text-muted">
            Kết quả duyệt tuyến, toạ độ, đại lý mới và trả lời hỗ trợ sẽ hiện ở đây.
          </p>
        </div>
      ) : (
        <NotificationList items={data.items} unread={data.unread} />
      )}

      {lastPage > 1 ? (
        <nav className="mt-4 flex items-center justify-between gap-3" aria-label="Phân trang">
          {data.page > 1 ? (
            <Link
              href={`${base}trang=${data.page - 1}`}
              className="font-bold text-brand hover:underline"
            >
              Trang trước
            </Link>
          ) : (
            <span />
          )}
          <span className="text-text-muted">
            Trang {formatNumber(data.page)} trên {formatNumber(lastPage)}
          </span>
          {data.page < lastPage ? (
            <Link
              href={`${base}trang=${data.page + 1}`}
              className="font-bold text-brand hover:underline"
            >
              Trang sau
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </HubLayout>
  );
}
