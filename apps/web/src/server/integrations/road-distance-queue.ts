import 'server-only';
import { Queue } from 'bullmq';
import {
  ROAD_DISTANCE_DEBOUNCE_MS,
  ROAD_DISTANCE_QUEUE,
  roadDistanceJobId,
  type RoadDistanceJob,
} from '@seedgw/contracts/road-distance';

// Xếp lịch tính km theo đường đi (V1b). Worker tính, web chỉ đẩy việc vào hàng đợi.
let queue: Queue | null = null;

/** Bật khi có cả Redis và máy chủ tìm đường; để trống OSRM_URL là tắt cột km theo đường. */
export function isRoadDistanceEnabled(): boolean {
  return Boolean(process.env.REDIS_URL?.trim() && process.env.OSRM_URL?.trim());
}

function roadQueue(): Queue | null {
  if (!isRoadDistanceEnabled()) return null;
  queue ??= new Queue(ROAD_DISTANCE_QUEUE, {
    connection: { url: process.env.REDIS_URL?.trim(), maxRetriesPerRequest: null },
  });
  return queue;
}

/**
 * Hẹn tính lại cả ngày sau 3 phút kể từ lần nhận dữ liệu cuối. Mỗi lần app gửi tiếp lại lùi hẹn,
 * nên một ngày chỉ tính khi nhân viên dừng gửi. Lỗi Redis chỉ ghi log, không làm hỏng việc nhận dữ liệu.
 */
export async function scheduleRoadDistance(job: RoadDistanceJob): Promise<void> {
  const target = roadQueue();
  if (!target) return;
  const id = roadDistanceJobId(job);
  try {
    await target.add('day', job, {
      delay: ROAD_DISTANCE_DEBOUNCE_MS,
      deduplication: { id, ttl: ROAD_DISTANCE_DEBOUNCE_MS, extend: true, replace: true },
      attempts: 3,
      backoff: { type: 'exponential', delay: 30_000 },
      removeOnComplete: 1000,
      removeOnFail: 1000,
    });
  } catch (error) {
    console.error('Không xếp được lịch tính km theo đường', id, error);
  }
}
