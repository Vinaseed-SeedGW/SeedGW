import { getClockOffsetMs, saveClockOffsetMs } from '../sync/track-db';

// Giờ trên ảnh check-in theo giờ máy chủ (M2), để chỉnh giờ trên máy không đổi được giờ in trên ảnh.
// Mỗi lần gọi máy chủ đọc header Date (chính xác tới giây) và đo độ lệch; mất mạng thì dùng lần đo trước.
// Lệch dưới 2 giây coi như không lệch vì header Date chỉ tới giây.
const NOISE_MS = 2_000;
// Chỉ ghi lại xuống máy khi đổi đáng kể, đỡ ghi SQLite sau mỗi lần gọi.
const SAVE_THRESHOLD_MS = 1_000;

let offsetMs: number | null = null;

function currentOffset(): number {
  offsetMs ??= getClockOffsetMs();
  return offsetMs;
}

/** Giờ hiện tại theo giờ máy chủ, tính bằng giờ máy cộng độ lệch đã đo. */
export function serverNow(): number {
  return Date.now() + currentOffset();
}

/** Gọi sau mỗi phản hồi từ máy chủ. sentAt, receivedAt là giờ máy lúc gửi và lúc nhận. */
export function noteServerDate(
  dateHeader: string | null,
  sentAt: number,
  receivedAt: number,
): void {
  if (!dateHeader) return;
  const server = Date.parse(dateHeader);
  if (Number.isNaN(server)) return;
  // Header Date làm tròn xuống giây: cộng nửa giây và nửa thời gian đi về để ra giờ máy chủ lúc nhận.
  const measured = server + 500 + (receivedAt - sentAt) / 2 - receivedAt;
  const next = Math.abs(measured) < NOISE_MS ? 0 : measured;
  if (Math.abs(next - currentOffset()) >= SAVE_THRESHOLD_MS) saveClockOffsetMs(next);
  offsetMs = next;
}
