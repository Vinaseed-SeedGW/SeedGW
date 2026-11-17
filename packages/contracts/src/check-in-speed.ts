import { distanceMeters } from './track-distance';

/** Hai lượt gần hơn mức này thì bỏ qua, để GPS chập chờn không gây báo nhầm (M5, duyệt 18/11/2026). */
export const SPEED_CHECK_MIN_DISTANCE_M = 2000;

export type SpeedCheckPoint = { id: string; capturedAt: number; lat: number; lng: number };

/**
 * Lượt check-in có tốc độ từ lượt liền trước (cùng nhân viên, trong ngày) vượt ngưỡng. Tốc độ tính theo
 * đường chim bay nên thấp hơn thực tế, khó báo nhầm. Hai lượt cùng giờ mà cách xa cũng gắn cờ.
 */
export function speedFlaggedIds(points: readonly SpeedCheckPoint[], maxKmh: number): Set<string> {
  const flagged = new Set<string>();
  const sorted = [...points].sort((a, b) => a.capturedAt - b.capturedAt);
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    if (!previous || !current) continue;
    const meters = distanceMeters(previous, current);
    if (meters < SPEED_CHECK_MIN_DISTANCE_M) continue;
    const hours = (current.capturedAt - previous.capturedAt) / 3_600_000;
    if (hours <= 0 || meters / 1000 / hours > maxKmh) flagged.add(current.id);
  }
  return flagged;
}

/** Tốc độ km/h từ lượt trước, dùng khi hiển thị; null khi là lượt đầu hoặc gần nhau. */
export function speedKmh(previous: SpeedCheckPoint, current: SpeedCheckPoint): number | null {
  const meters = distanceMeters(previous, current);
  const hours = (current.capturedAt - previous.capturedAt) / 3_600_000;
  if (meters < SPEED_CHECK_MIN_DISTANCE_M || hours <= 0) return null;
  return meters / 1000 / hours;
}
