'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { formatDateTime } from '@seedgw/contracts/format';
import { NOTIFICATION_KIND_LABEL, type NotificationItem } from '@seedgw/contracts/notifications';
import { useToast } from '@seedgw/ui/toast';
import { markNotificationsReadAction } from '@/server/actions/notifications';

type Props = { items: NotificationItem[]; unread: number };

/** Danh sách thông báo; bấm một thông báo thì đánh dấu đã đọc rồi mở trang tương ứng. */
export function NotificationList({ items, unread }: Props) {
  const router = useRouter();
  const { actions: toast } = useToast();
  const [isPending, startTransition] = useTransition();

  function open(item: NotificationItem) {
    startTransition(async () => {
      if (!item.read) await markNotificationsReadAction({ ids: [item.id] });
      if (item.href) router.push(item.href);
      else router.refresh();
    });
  }

  function markAll() {
    startTransition(async () => {
      const result = await markNotificationsReadAction({ all: true });
      if (!result.ok) toast.show({ tone: 'error', message: result.message });
      router.refresh();
    });
  }

  return (
    <>
      {unread > 0 ? (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={markAll}
            disabled={isPending}
            className="inline-flex h-9 items-center rounded-md border border-brand bg-surface px-3 font-bold text-brand hover:bg-brand-soft disabled:opacity-60"
          >
            Đánh dấu tất cả đã đọc
          </button>
        </div>
      ) : null}
      <ul className="mt-3 divide-y divide-border rounded-lg border border-border bg-surface">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => open(item)}
              disabled={isPending}
              className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-brand disabled:cursor-wait"
            >
              <span
                className={`mt-2 size-2.5 flex-none rounded-full ${item.read ? 'bg-transparent' : 'bg-brand'}`}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className={item.read ? '' : 'font-bold'}>{item.title}</span>
                  <span className="text-sm text-text-muted tabular-nums">
                    {formatDateTime(item.createdAt)}
                  </span>
                </span>
                <span className="mt-0.5 block text-text-muted">{item.body}</span>
                <span className="mt-1 block text-sm text-text-muted">
                  {NOTIFICATION_KIND_LABEL[item.kind]}
                  {item.read ? '' : ', chưa đọc'}
                  {item.href ? '' : ', xem chi tiết trên app'}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
