import type { MobileDealerOption, MobileDealersResult } from '@seedgw/contracts/dealers';
import { apiCall } from './client';

export type DealerSearch =
  { ok: true; items: MobileDealerOption[]; radiusM: number } | { ok: false; message: string };

/** Đại lý chọn khi check-in, kèm toạ độ đã duyệt để app tự tính khoảng cách (M4). */
export type DealerChoice = { id: string; name: string; lat: number | null; lng: number | null };

// Bán kính mặc định trong Tham số, dùng khi chưa tải được danh sách đại lý lần nào.
const DEFAULT_RADIUS_M = 200;
let lastRadiusM = DEFAULT_RADIUS_M;

/** Bán kính check-in hợp lệ theo lần tải danh sách đại lý gần nhất. */
export function checkInRadiusM(): number {
  return lastRadiusM;
}

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
  const result = await apiCall<MobileDealersResult>(`/api/mobile/dealers?${params.toString()}`, {
    method: 'GET',
  });
  if (!result.ok) return { ok: false, message: result.message };
  // Máy chủ cũ chưa trả bán kính thì giữ giá trị trước.
  if (typeof result.data.radiusM === 'number') lastRadiusM = result.data.radiusM;
  return { ok: true, items: result.data.items, radiusM: lastRadiusM };
}
