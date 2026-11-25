import 'server-only';
import { cache } from 'react';
import type { NotificationItem, NotificationPage } from '@seedgw/contracts/notifications';
import { requireUser } from '@/server/auth/current-user';
import { countUnread, readNotifications } from '@/server/services/notifications';

export async function listMyNotifications(input: {
  page: number;
  pageSize: number;
  unreadOnly: boolean;
}): Promise<NotificationPage> {
  const user = await requireUser();
  return readNotifications(user, input);
}

/** Số chưa đọc trên chuông. Lỗi thì trả 0 để không làm hỏng trang. */
export const getUnreadNotificationCount = cache(async (): Promise<number> => {
  const user = await requireUser();
  try {
    return await countUnread(user.id);
  } catch {
    return 0;
  }
});

export async function getRecentNotifications(limit: number): Promise<NotificationItem[]> {
  const user = await requireUser();
  const page = await readNotifications(user, { page: 1, pageSize: limit, unreadOnly: false });
  return page.items;
}
