import type { MobileDealerOption } from '@dms/contracts/dealers';
import { apiCall } from './client';

export type DealerSearch =
  { ok: true; items: MobileDealerOption[] } | { ok: false; message: string };

/** Đại lý trong phạm vi của nhân viên, có vị trí thì đại lý gần nhất lên đầu (A7). */
export async function searchDealers(
  q: string,
  point: { lat: number; lng: number } | null,
): Promise<DealerSearch> {
  const params = new URLSearchParams();
  if (q.trim()) params.set('q', q.trim());
  if (point) {
    params.set('lat', String(point.lat));
    params.set('lng', String(point.lng));
  }
  const result = await apiCall<{ items: MobileDealerOption[] }>(
    `/api/mobile/dealers?${params.toString()}`,
    { method: 'GET' },
  );
  return result.ok
    ? { ok: true, items: result.data.items }
    : { ok: false, message: result.message };
}
