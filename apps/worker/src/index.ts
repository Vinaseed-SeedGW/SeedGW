import { Queue, Worker, type Job } from 'bullmq';
import { FAST_SYNC_QUEUE } from '@dms/contracts/fast';
import {
  PUSH_QUEUE,
  PUSH_RECEIPT_DELAY_MS,
  type PushReceiptJob,
  type PushSendJob,
} from '@dms/contracts/push';
import { ROAD_DISTANCE_QUEUE, type RoadDistanceJob } from '@dms/contracts/road-distance';
import { runFastCustomerSync } from './fast-sync';
import { checkPushReceipts, createCheckInReminders, sendPushMessages } from './push';
import { roadDistanceProvider } from './osrm';
import { computeRoadDay, userDaysWithCheckIns } from './road-distance';
import { autoCloseDone, purgeExpired } from './support';

// Worker chạy nền (F8): km theo đường đi (V1b), việc định kỳ của Hỗ trợ (T5), đồng bộ FAST (A8).
const REDIS_URL = process.env.REDIS_URL?.trim();
const DAY_MS = 86_400_000;
const SUPPORT_QUEUE = 'support';

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

function logJobs(worker: Worker, label: string) {
  worker.on('completed', (job, result) =>
    console.log(`${label}: xong ${job.name} ${job.id}`, JSON.stringify(result ?? null)),
  );
  worker.on('failed', (job, error) =>
    console.error(`${label}: lỗi ${job?.name} ${job?.id}, lần ${job?.attemptsMade}`, error.message),
  );
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
    ...(await startSupport(connection)),
    ...(await startFastSync(connection)),
    ...(await startPush(connection)),
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
