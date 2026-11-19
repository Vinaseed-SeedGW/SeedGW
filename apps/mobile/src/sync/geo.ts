export { distanceMeters, type GeoPoint } from '@seedgw/contracts/track-distance';

// Việt Nam không đổi giờ theo mùa nên cộng cố định 7 giờ là đủ, không phụ thuộc Intl của máy.
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

function vnParts(epochMs: number) {
  const d = new Date(epochMs + VN_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`,
    time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`,
    hour: d.getUTCHours(),
    dayKey: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
  };
}

export function formatVnDate(epochMs: number): string {
  return vnParts(epochMs).date;
}

export function formatVnTime(epochMs: number): string {
  return vnParts(epochMs).time;
}

export function vnHour(epochMs: number): number {
  return vnParts(epochMs).hour;
}

/** Mốc 00:00 giờ Việt Nam của ngày chứa `epochMs`, tính theo epoch UTC. */
export function startOfVnDay(epochMs: number): number {
  const shifted = epochMs + VN_OFFSET_MS;
  return shifted - (shifted % 86_400_000) - VN_OFFSET_MS;
}

export function vnDayKey(epochMs: number): string {
  return vnParts(epochMs).dayKey;
}

export function formatCoord(value: number): string {
  return value.toFixed(5);
}

export function formatKm(meters: number): string {
  return (meters / 1000).toFixed(3).replace('.', ',');
}
