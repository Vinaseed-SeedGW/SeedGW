import type { MobileCustomerOption, MobileCustomersResult } from '@seedgw/contracts/customers';
import { apiCall } from './client';

export type CustomerSearch =
  { ok: true; items: MobileCustomerOption[] } | { ok: false; message: string };

/** S1: khách hàng chọn khi check-in loại Khách hàng. */
export type CustomerChoice = { id: string; name: string };

/** Khách hàng trong phạm vi của nhân viên, có vị trí thì khách hàng gần nhất lên đầu. */
export async function searchCustomers(
  q: string,
  point: { lat: number; lng: number } | null,
): Promise<CustomerSearch> {
  const params = new URLSearchParams();
  if (q.trim()) params.set('q', q.trim());
  if (point) {
    params.set('lat', String(point.lat));
    params.set('lng', String(point.lng));
  }
  const result = await apiCall<MobileCustomersResult>(
    `/api/mobile/customers?${params.toString()}`,
    { method: 'GET' },
  );
  if (!result.ok) return { ok: false, message: result.message };
  // Máy chủ cũ chưa có danh mục khách hàng thì coi như danh sách trống.
  return { ok: true, items: Array.isArray(result.data.items) ? result.data.items : [] };
}
