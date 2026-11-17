import type { MyRoutesResult, SubmitRoutePlanInput } from '@dms/contracts/route-plans';
import { apiCall } from './client';
import type { Loaded } from './targets';

/** Tuyến của tôi (S8): kỳ đăng ký được, tuyến hôm nay đã duyệt. */
export async function loadMyRoutes(): Promise<Loaded<MyRoutesResult>> {
  const result = await apiCall<MyRoutesResult>('/api/mobile/routes', { method: 'GET' });
  return result.ok ? { ok: true, data: result.data } : { ok: false, message: result.message };
}

export async function submitMyRoute(input: SubmitRoutePlanInput): Promise<Loaded<MyRoutesResult>> {
  const result = await apiCall<MyRoutesResult>('/api/mobile/routes', {
    method: 'POST',
    json: input,
  });
  return result.ok ? { ok: true, data: result.data } : { ok: false, message: result.message };
}

/** Rút lại phiếu tuyến khi chưa ai duyệt, rồi đọc lại tuyến. */
export async function withdrawRoute(code: string): Promise<Loaded<MyRoutesResult>> {
  const result = await apiCall<unknown>(
    `/api/mobile/approvals/${encodeURIComponent(code)}/withdraw`,
    { method: 'POST', json: {} },
  );
  if (!result.ok) return { ok: false, message: result.message };
  return loadMyRoutes();
}
