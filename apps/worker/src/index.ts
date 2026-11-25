import { Queue, Worker, type Job } from 'bullmq';
import { recomputeDailyVisitStats, touchedVisitDays } from '@seedgw/db/daily-visit-stats';
import { ensureTrackPointPartitions, purgeExpiredTrackingData } from '@seedgw/db/data-retention';
import { purgeOldErrors, recordError } from '@seedgw/db/error-log';
import { FAST_SYNC_QUEUE } from '@seedgw/contracts/fast';
import {
  PUSH_QUEUE,
  PUSH_RECEIPT_DELAY_MS,
  type PushReceiptJob,
  type PushSendJob,
} from '@seedgw/contracts/push';
import {
  CHECK_IN_FOLLOWUP_QUEUE,
  ROAD_DISTANCE_DEBOUNCE_MS,
  ROAD_DISTANCE_QUEUE,
  roadDistanceJobId,
  type CheckInFollowupJob,
  type RoadDistanceJob,
} from '@seedgw/contracts/road-distance';
import {
  fillMissingAddresses,
  recomputeDayDistances,
  usersMissingAddresses,
} from '@seedgw/db/check-in-followup';
import { runFastCustomerSync } from './fast-sync';
import { checkPushReceipts, createCheckInReminders, sendPushMessages } from './push';
import { roadDistanceProvider } from './osrm';
import { computeRoadDay, userDaysWithCheckIns } from './road-distance';
import { autoCloseDone, purgeExpired } from './support';

// Worker chạy nền (F8): km theo GPS và địa chỉ sau check-in, km theo đường đi (V1b), việc định kỳ của Hỗ trợ (T5), đồng bộ FAST (A8), bảng gộp lượt
// ghé thăm theo ngày (K1).
const REDIS_URL = process.env.REDIS_URL?.trim();
const DAY_MS = 86_400_000;
const SUPPORT_QUEUE = 'support';
const DAILY_STATS_QUEUE = 'daily-visit-stats';
const DATA_RETENTION_QUEUE = 'data-retention';
// Mỗi lần chạy xét check-in tạo hoặc sửa trong 30 phút qua (lịch 15 phút, chồng lên nhau để không sót).
const DAILY_STATS_LOOKBACK_MS = 30 * 60_000;
const DAILY_STATS_NIGHTLY_DAYS = 7;

const vnToday = () => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);

type Connection = { url: string; maxRetriesPerRequest: null };

async function startRoadDistance(connection: Connection): Promise<Array<Queue | Worker>> {
  const provider = roadDistanceProvider();
  if (!provider) {
    console.log('Chưa bật máy chủ tìm đường (OSRM_URL trống): báo cáo chỉ có km theo GPS.');
    return [];
  }
  const queue = new Queue(ROAD_DISTANCE_QUEUE, { connection });
  // Chốt lại cả ngày lúc 21:00 giờ Việt Nam, sau giờ tự dừng ghi hành trình.
  await queue.upsertJobScheduler(
    'road-distance-nightly',
    { pattern: '0 21 * * *', tz: 'Asia/Ho_Chi_Minh' },
    {
      name: 'nightly',
      data: {},
      opts: { attempts: 3, backoff: { type: 'exponential', delay: 60_000 } },
    },
  );
  const worker = new Worker(
    ROAD_DISTANCE_QUEUE,
    async (job: Job) => {
      if (job.name === 'nightly') {
        const from = new Date(`${vnToday()}T00:00:00+07:00`);
        const pairs = await userDaysWithCheckIns(from, new Date(from.getTime() + DAY_MS));
        for (const pair of pairs) await computeRoadDay(provider, pair.userId, pair.day);
        return { days: pairs.length };
      }
      const data = job.data as RoadDistanceJob;
      return computeRoadDay(provider, data.userId, data.day);
    },
    { connection, concurrency: 2 },
  );
  logJobs(worker, 'Km theo đường');
  return [queue, worker];
}

async function startSupport(connection: Connection): Promise<Array<Queue | Worker>> {
  const queue = new Queue(SUPPORT_QUEUE, { connection });
  // 15 phút một lần: tự đóng yêu cầu đã xong quá 7 ngày, xoá nội dung quá 18 tháng.
  await queue.upsertJobScheduler(
    'support-maintenance',
    { pattern: '*/15 * * * *', tz: 'Asia/Ho_Chi_Minh' },
    {
      name: 'maintenance',
      data: {},
      opts: { attempts: 3, backoff: { type: 'exponential', delay: 60_000 } },
    },
  );
  const worker = new Worker(
    SUPPORT_QUEUE,
    async () => {
      const now = new Date();
      return { closed: await autoCloseDone(now), purged: await purgeExpired(now) };
    },
    { connection, concurrency: 1 },
  );
  logJobs(worker, 'Hỗ trợ');
  return [queue, worker];
}

async function startDailyStats(connection: Connection): Promise<Array<Queue | Worker>> {
  const queue = new Queue(DAILY_STATS_QUEUE, { connection });
  const opts = {
    attempts: 3,
    backoff: { type: 'exponential' as const, delay: 60_000 },
    removeOnComplete: 200,
    removeOnFail: 200,
  };
  // 15 phút một lần cho ngày có check-in mới hoặc gửi trễ; 00:30 tính lại 7 ngày gần nhất phòng khi worker dừng.
  await queue.upsertJobScheduler(
    'daily-stats-refresh',
    { pattern: '*/15 * * * *', tz: 'Asia/Ho_Chi_Minh' },
    { name: 'refresh', data: {}, opts },
  );
  await queue.upsertJobScheduler(
    'daily-stats-nightly',
    { pattern: '30 0 * * *', tz: 'Asia/Ho_Chi_Minh' },
    { name: 'nightly', data: {}, opts },
  );
  const worker = new Worker(
    DAILY_STATS_QUEUE,
    async (job: Job) => {
      const days =
        job.name === 'nightly'
          ? Array.from({ length: DAILY_STATS_NIGHTLY_DAYS }, (_, index) =>
              new Date(Date.parse(`${vnToday()}T00:00:00Z`) - (index + 1) * DAY_MS)
                .toISOString()
                .slice(0, 10),
            )
          : await touchedVisitDays(new Date(Date.now() - DAILY_STATS_LOOKBACK_MS));
      const rows = await recomputeDailyVisitStats(days);
      return { days: days.length, rows };
    },
    { connection, concurrency: 1 },
  );
  logJobs(worker, 'Bảng gộp lượt ghé');
  return [queue, worker];
}

async function startFastSync(connection: Connection): Promise<Array<Queue | Worker>> {
  const queue = new Queue(FAST_SYNC_QUEUE, { connection });
  // Lịch 5 phút một lần; mỗi lần tự kiểm đã đủ chu kỳ ở Tham số chưa rồi mới gọi FAST.
  await queue.upsertJobScheduler(
    'fast-customers',
    { pattern: '*/5 * * * *', tz: 'Asia/Ho_Chi_Minh' },
    { name: 'schedule', data: {} },
  );
  const worker = new Worker(
    FAST_SYNC_QUEUE,
    async (job: Job) => runFastCustomerSync(job.name === 'manual' ? 'MANUAL' : 'SCHEDULE'),
    { connection, concurrency: 1 },
  );
  logJobs(worker, 'Đồng bộ FAST');
  return [queue, worker];
}

async function startPush(connection: Connection): Promise<Array<Queue | Worker>> {
  const queue = new Queue(PUSH_QUEUE, { connection });
  // Nhắc chưa check-in: đầu mỗi giờ thứ Hai tới thứ Bảy, job tự kiểm đúng giờ ở Tham số.
  await queue.upsertJobScheduler(
    'check-in-reminder',
    { pattern: '0 * * * 1-6', tz: 'Asia/Ho_Chi_Minh' },
    { name: 'reminder', data: {} },
  );
  const sendOptions = {
    attempts: 5,
    backoff: { type: 'exponential' as const, delay: 30_000 },
    removeOnComplete: 1000,
    removeOnFail: 1000,
  };
  const worker = new Worker(
    PUSH_QUEUE,
    async (job: Job) => {
      if (job.name === 'reminder') {
        const { day, messageIds } = await createCheckInReminders();
        if (messageIds.length > 0) {
          await queue.add('send', { messageIds } satisfies PushSendJob, sendOptions);
        }
        return { day, reminders: messageIds.length };
      }
      if (job.name === 'receipts') {
        return checkPushReceipts((job.data as PushReceiptJob).tickets);
      }
      const result = await sendPushMessages((job.data as PushSendJob).messageIds);
      if (result.receipts.length > 0) {
        await queue.add('receipts', { tickets: result.receipts } satisfies PushReceiptJob, {
          delay: PUSH_RECEIPT_DELAY_MS,
          attempts: 3,
          backoff: { type: 'exponential', delay: 60_000 },
          removeOnComplete: 1000,
          removeOnFail: 1000,
        });
      }
      return { sent: result.sent, noToken: result.noToken, failed: result.failed };
    },
    { connection, concurrency: 2 },
  );
  logJobs(worker, 'Thông báo đẩy');
  return [queue, worker];
}

/**
 * F8: việc sau khi nhận check-in, điểm GPS. Web xếp việc theo người và ngày (gộp lần gửi sát nhau), worker tính
 * km theo GPS, cờ tốc độ, lấy địa chỉ, rồi hẹn tính km theo đường. Lỗi thì thử lại 5 lần, giãn dần.
 */
async function startCheckInFollowup(connection: Connection): Promise<Array<Queue | Worker>> {
  const queue = new Queue(CHECK_IN_FOLLOWUP_QUEUE, { connection });
  const roadQueue = roadDistanceProvider() ? new Queue(ROAD_DISTANCE_QUEUE, { connection }) : null;
  // Quét 10 phút một lần các check-in còn thiếu địa chỉ do Vietmap lỗi lúc nhận.
  await queue.upsertJobScheduler(
    'address-sweep',
    { every: 10 * 60_000 },
    {
      name: 'address-sweep',
      data: {},
      opts: { attempts: 1, removeOnComplete: 100, removeOnFail: 100 },
    },
  );
  const worker = new Worker(
    CHECK_IN_FOLLOWUP_QUEUE,
    async (job: Job) => {
      if (job.name === 'address-sweep') {
        const users = await usersMissingAddresses();
        for (const userId of users) await fillMissingAddresses(userId);
        return { users: users.length };
      }
      const data = job.data as CheckInFollowupJob;
      await recomputeDayDistances(data.userId, data.day);
      await fillMissingAddresses(data.userId);
      if (roadQueue) {
        const id = roadDistanceJobId(data);
        await roadQueue.add('day', data satisfies RoadDistanceJob, {
          delay: ROAD_DISTANCE_DEBOUNCE_MS,
          deduplication: { id, ttl: ROAD_DISTANCE_DEBOUNCE_MS, extend: true, replace: true },
          attempts: 3,
          backoff: { type: 'exponential', delay: 30_000 },
          removeOnComplete: 1000,
          removeOnFail: 1000,
        });
      }
      return { userId: data.userId, day: data.day };
    },
    { connection, concurrency: 4 },
  );
  logJobs(worker, 'Việc sau check-in');
  return roadQueue ? [queue, roadQueue, worker] : [queue, worker];
}

/** D5: mỗi đêm 02:00 tạo bảng tháng sắp tới cho điểm GPS, bỏ điểm quá 45 ngày, dòng check-in quá 18 tháng. */
async function startDataRetention(connection: Connection): Promise<Array<Queue | Worker>> {
  // Lúc khởi động cũng tạo sẵn bảng tháng, để worker mới bật vào ngày đầu tháng vẫn có chỗ ghi.
  await ensureTrackPointPartitions();
  const queue = new Queue(DATA_RETENTION_QUEUE, { connection });
  await queue.upsertJobScheduler(
    'data-retention-nightly',
    { pattern: '0 2 * * *', tz: 'Asia/Ho_Chi_Minh' },
    {
      name: 'nightly',
      data: {},
      opts: { attempts: 3, backoff: { type: 'exponential', delay: 300_000 } },
    },
  );
  const worker = new Worker(
    DATA_RETENTION_QUEUE,
    async () => {
      const partitions = await ensureTrackPointPartitions();
      const purged = await purgeExpiredTrackingData();
      const errors = await purgeOldErrors();
      return { partitions: partitions.length, ...purged, deletedErrors: errors };
    },
    { connection, concurrency: 1 },
  );
  logJobs(worker, 'Giữ dữ liệu');
  return [queue, worker];
}

function logJobs(worker: Worker, label: string) {
  worker.on('completed', (job, result) =>
    console.log(`${label}: xong ${job.name} ${job.id}`, JSON.stringify(result ?? null)),
  );
  worker.on('failed', (job, error) => {
    console.error(`${label}: lỗi ${job?.name} ${job?.id}, lần ${job?.attemptsMade}`, error.message);
    // F9: chỉ ghi vào bảng lỗi khi đã hết lượt thử lại.
    if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
      void recordError({
        source: 'WORKER',
        error,
        path: `${worker.name}/${job.name}`,
        context: { label, attempts: job.attemptsMade },
      });
    }
  });
}

async function main() {
  if (!REDIS_URL) {
    console.log('Worker chạy không có hàng đợi: thiếu REDIS_URL.');
    setInterval(() => undefined, 60_000);
    return;
  }
  const connection: Connection = { url: REDIS_URL, maxRetriesPerRequest: null };
  const parts = [
    ...(await startRoadDistance(connection)),
    ...(await startCheckInFollowup(connection)),
    ...(await startSupport(connection)),
    ...(await startDailyStats(connection)),
    ...(await startFastSync(connection)),
    ...(await startPush(connection)),
    ...(await startDataRetention(connection)),
  ];
  console.log('Worker đã sẵn sàng.');

  const shutdown = async () => {
    await Promise.all(parts.map((part) => part.close()));
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

void main();
