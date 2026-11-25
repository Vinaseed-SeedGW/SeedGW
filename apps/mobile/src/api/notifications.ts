import type { MobileNotificationPage } from '@seedgw/contracts/notifications';
import { apiCall } from './client';

export type LoadedNotifications =
  { ok: true; page: MobileNotificationPage } | { ok: false; message: string };

/** D4: thông báo đã nhận, mới nhất lên đầu. */
export async function loadNotifications(page = 1): Promise<LoadedNotifications> {
  const result = await apiCall<MobileNotificationPage>(`/api/mobile/notifications?page=${page}`, {
    method: 'GET',
  });
  if (!result.ok) return { ok: false, message: result.message };
  return { ok: true, page: result.data };
}

export async function markNotificationsRead(
  input: { all: true } | { ids: string[] },
): Promise<boolean> {
  const result = await apiCall<{ count: number }>('/api/mobile/notifications', {
    method: 'POST',
    json: input,
  });
  return result.ok;
}
