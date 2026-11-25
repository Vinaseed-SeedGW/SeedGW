import 'server-only';
import { Queue } from 'bullmq';
import { fillMissingAddresses, recomputeDayDistances } from '@seedgw/db/check-in-followup';
import {
  CHECK_IN_FOLLOWUP_DEBOUNCE_MS,
  CHECK_IN_FOLLOWUP_QUEUE,
  checkInFollowupJobId,
  type CheckInFollowupJob,
} from '@seedgw/contracts/road-distance';
import { scheduleRoadDistance } from './road-distance-queue';

// F8: tính km theo GPS, cờ tốc độ, lấy địa chỉ chạy ở worker qua hàng đợi, có thử lại và không làm trùng.
// Máy dev không có Redis thì chạy thẳng như trước, để không phải bật worker khi thử.
let queue: Queue | null = null;

function followupQueue(): Queue | null {
  const url = process.env.REDIS_URL?.trim();
  if (!url) return null;
  queue ??= new Queue(CHECK_IN_FOLLOWUP_QUEUE, { connection: { url, maxRetriesPerRequest: null } });
  return queue;
}

export async function scheduleCheckInFollowup(job: CheckInFollowupJob): Promise<void> {
  const target = followupQueue();
  if (!target) {
    await recomputeDayDistances(job.userId, job.day);
    await fillMissingAddresses(job.userId);
    await scheduleRoadDistance(job);
    return;
  }
  const id = checkInFollowupJobId(job);
  try {
    await target.add('day', job, {
      delay: CHECK_IN_FOLLOWUP_DEBOUNCE_MS,
      deduplication: { id, ttl: CHECK_IN_FOLLOWUP_DEBOUNCE_MS, extend: true, replace: true },
      attempts: 5,
      backoff: { type: 'exponential', delay: 15_000 },
      removeOnComplete: 1000,
      removeOnFail: 1000,
    });
  } catch (error) {
    // Redis lỗi thì chạy thẳng, check-in đã lưu nên chỉ chậm phần km và địa chỉ.
    console.error('Không xếp được việc sau check-in, chạy thẳng', id, error);
    await recomputeDayDistances(job.userId, job.day);
    await fillMissingAddresses(job.userId);
  }
}
