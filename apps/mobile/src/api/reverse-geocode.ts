import { distanceMeters, type GeoPoint } from '../sync/geo';
import { apiCall } from './client';
import { serverEnabled } from './session';

// Có máy chủ thì hỏi địa chỉ qua máy chủ (V3), khoá Vietmap không nằm trên điện thoại.
// Bản thử R3 chưa có máy chủ thì gọi thẳng Vietmap bằng khoá gắn trong app (duyệt 13/11/2026), thử xong đổi khoá.
const API_KEY = process.env.EXPO_PUBLIC_VIETMAP_API_KEY ?? '';
const TIMEOUT_MS = 4_000;
// Vietmap trả khoảng cách tới số nhà khớp được, theo km. Xa hơn 100 m thì số nhà chỉ là tham khảo.
const EXACT_ADDRESS_KM = 0.1;
// Đứng trong bán kính này thì dùng lại địa chỉ vừa lấy, đỡ tốn lượt gọi.
const REUSE_RADIUS_M = 25;

type VietmapBoundary = { full_name?: string; type?: number };
type VietmapResult = {
  name?: string;
  display?: string;
  distance?: number;
  boundaries?: VietmapBoundary[];
};

export type GeocodeResult =
  | { ok: true; address: string }
  | { ok: false; reason: 'NO_KEY' | 'OFFLINE' | 'NOT_FOUND' | 'HTTP' };

/** Có cách lấy địa chỉ: qua máy chủ SeedGW (bản chính thức) hoặc khoá gắn trong bản thử R3. */
export function hasGeocodeKey(): boolean {
  return serverEnabled() || API_KEY.length > 0;
}

async function viaServer(point: GeoPoint): Promise<GeocodeResult> {
  const result = await apiCall<{ address: string | null }>(
    `/api/mobile/address?lat=${point.lat}&lng=${point.lng}`,
    { method: 'GET' },
  );
  if (!result.ok) return { ok: false, reason: result.retryable ? 'OFFLINE' : 'HTTP' };
  return result.data.address
    ? { ok: true, address: result.data.address }
    : { ok: false, reason: 'NOT_FOUND' };
}

function formatResult(result: VietmapResult): string | null {
  const area = (result.boundaries ?? [])
    .map((boundary) => boundary.full_name?.trim())
    .filter((part): part is string => Boolean(part));
  const street = result.name?.trim();
  if (!street && area.length === 0) return result.display?.trim() || null;
  const near = (result.distance ?? 0) > EXACT_ADDRESS_KM ? 'Gần ' : '';
  return [street ? `${near}${street}` : null, ...area].filter(Boolean).join(', ');
}

let lastHit: { point: GeoPoint; address: string } | null = null;

/** Đổi toạ độ ra địa chỉ dạng "33 Hàng Đào, Phường Hoàn Kiếm, Thành phố Hà Nội". */
export async function reverseGeocode(point: GeoPoint): Promise<GeocodeResult> {
  if (!hasGeocodeKey()) return { ok: false, reason: 'NO_KEY' };
  if (lastHit && distanceMeters(lastHit.point, point) <= REUSE_RADIUS_M) {
    return { ok: true, address: lastHit.address };
  }
  if (serverEnabled()) {
    const outcome = await viaServer(point);
    if (outcome.ok) lastHit = { point, address: outcome.address };
    return outcome;
  }
  const url =
    'https://maps.vietmap.vn/api/reverse/v4' +
    `?apikey=${encodeURIComponent(API_KEY)}&lat=${point.lat}&lng=${point.lng}&display_type=1`;
  // React Native chưa chắc có AbortSignal.timeout nên tự hẹn giờ huỷ.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return { ok: false, reason: 'HTTP' };
    const body: unknown = await response.json();
    const first = Array.isArray(body) ? (body[0] as VietmapResult | undefined) : undefined;
    const address = first ? formatResult(first) : null;
    if (!address) return { ok: false, reason: 'NOT_FOUND' };
    lastHit = { point, address };
    return { ok: true, address };
  } catch {
    return { ok: false, reason: 'OFFLINE' };
  } finally {
    clearTimeout(timer);
  }
}

export const GEOCODE_FAILURE_TEXT: Record<Extract<GeocodeResult, { ok: false }>['reason'], string> =
  {
    NO_KEY: 'chưa cài khoá bản đồ',
    OFFLINE: 'chưa lấy được, máy đang không có mạng',
    NOT_FOUND: 'bản đồ không có địa chỉ ở chỗ này',
    HTTP: 'máy chủ bản đồ đang lỗi',
  };
