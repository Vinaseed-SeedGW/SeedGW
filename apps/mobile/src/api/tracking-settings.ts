import { mobileTrackingSettings } from '@dms/contracts/tracking-settings';
import { saveTrackingSettings } from '../sync/track-db';
import { apiCall } from './client';

/** Lấy tham số ghi hành trình khi mở app có mạng (A9b). Lỗi thì giữ bản đã lưu, không báo người dùng. */
export async function refreshTrackingSettings(): Promise<void> {
  const result = await apiCall<{ tracking?: unknown }>('/api/mobile/settings', { method: 'GET' });
  if (!result.ok) return;
  const parsed = mobileTrackingSettings.safeParse(result.data.tracking);
  if (parsed.success) saveTrackingSettings(parsed.data);
}
