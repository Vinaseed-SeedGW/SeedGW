// Đổi toạ độ ra địa chỉ qua Vietmap (CHECK_IN_PLAN §3.6). Khoá chỉ nằm trên máy chủ.
const TIMEOUT_MS = 5_000;
// Vietmap trả khoảng cách tới số nhà khớp được theo km. Xa hơn 100 m thì ghi "Gần" phía trước.
const EXACT_ADDRESS_KM = 0.1;
// Ô khoảng 50 m: cùng ô thì dùng lại địa chỉ, đỡ tốn lượt gọi khi nhiều người đứng cùng chỗ.
const CELL_DEGREES = 0.0005;
const CACHE_LIMIT = 5_000;

type VietmapResult = {
  name?: string;
  display?: string;
  distance?: number;
  boundaries?: { full_name?: string }[];
};

export type GeocodeOutcome =
  { ok: true; address: string } | { ok: false; reason: 'NO_KEY' | 'NOT_FOUND' | 'UNAVAILABLE' };

const cache = new Map<string, string>();

function cellKey(lat: number, lng: number): string {
  return `${Math.round(lat / CELL_DEGREES)}:${Math.round(lng / CELL_DEGREES)}`;
}

export function formatVietmapAddress(result: VietmapResult): string | null {
  const area = (result.boundaries ?? [])
    .map((boundary) => boundary.full_name?.trim())
    .filter((part): part is string => Boolean(part));
  const street = result.name?.trim();
  if (!street && area.length === 0) return result.display?.trim() || null;
  const near = (result.distance ?? 0) > EXACT_ADDRESS_KM ? 'Gần ' : '';
  return [street ? `${near}${street}` : null, ...area].filter(Boolean).join(', ');
}

export async function reverseGeocode(lat: number, lng: number): Promise<GeocodeOutcome> {
  const key = process.env.VIETMAP_API_KEY?.trim();
  if (!key) return { ok: false, reason: 'NO_KEY' };
  const cell = cellKey(lat, lng);
  const cached = cache.get(cell);
  if (cached) return { ok: true, address: cached };

  const url =
    'https://maps.vietmap.vn/api/reverse/v4' +
    `?apikey=${encodeURIComponent(key)}&lat=${lat}&lng=${lng}&display_type=1`;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok) return { ok: false, reason: 'UNAVAILABLE' };
    const body: unknown = await response.json();
    const first = Array.isArray(body) ? (body[0] as VietmapResult | undefined) : undefined;
    const address = first ? formatVietmapAddress(first) : null;
    if (!address) return { ok: false, reason: 'NOT_FOUND' };
    if (cache.size >= CACHE_LIMIT) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(cell, address);
    return { ok: true, address };
  } catch {
    return { ok: false, reason: 'UNAVAILABLE' };
  }
}
