import { Queue, Worker, type Job } from 'bullmq';
import { ROAD_DISTANCE_QUEUE, type RoadDistanceJob } from '@dms/contracts/road-distance';
import {
  mattermostEnabled,
  recordMattermost,
  sendMattermost,
  type MattermostJob,
} from './mattermost';
import { roadDistanceProvider } from './osrm';
import { computeRoadDay, userDaysWithCheckIns } from './road-distance';
import { autoCloseDone, findOverdueBlockers, markAlerted, purgeExpired } from './support';

// Worker chạy nền (F8): km theo đường đi (V1b), việc định kỳ của Hỗ trợ và gửi Mattermost (T4, T5).
const REDIS_URL = process.env.REDIS_URL?.trim();
const DAY_MS = 86_400_000;
const SUPPORT_QUEUE = 'support';
const INTEGRATIONS_QUEUE = 'integrations';

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
  const integrations = new Queue(INTEGRATIONS_QUEUE, { connection });
  // 15 phút một lần: tự đóng, xoá quá 18 tháng, báo lỗi chặn công việc quá hạn.
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
      const closed = await autoCloseDone(now);
      const purged = await purgeExpired(now);
      const alerts = await findOverdueBlockers(now);
      for (const alert of alerts) {
        const job: MattermostJob = { key: alert.key, text: alert.text };
        if ((await recordMattermost(job)) && mattermostEnabled()) {
          // jobId theo khoá nhật ký: có xếp lại cũng không gửi trùng.
          await integrations.add('mattermost', job, {
            jobId: job.key.replace(/:/g, '-'),
            attempts: 5,
            backoff: { type: 'exponential', delay: 60_000 },
            removeOnComplete: 1000,
            removeOnFail: 1000,
          });
        }
        await markAlerted(alert.requestId, now);
      }
      return { closed, purged, alerts: alerts.length };
    },
    { connection, concurrency: 1 },
  );
  const sender = new Worker(
    INTEGRATIONS_QUEUE,
    async (job: Job) => {
      if (job.name === 'mattermost') await sendMattermost(job.data as MattermostJob);
    },
    { connection, concurrency: 1 },
  );
  logJobs(worker, 'Hỗ trợ');
  logJobs(sender, 'Gửi ra ngoài');
  if (!mattermostEnabled()) {
    console.log(
      'Chưa cấu hình MATTERMOST_WEBHOOK_URL: lỗi quá hạn chỉ ghi nhật ký, không gửi Mattermost.',
    );
  }
  return [queue, integrations, worker, sender];
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
  const parts = [...(await startRoadDistance(connection)), ...(await startSupport(connection))];
  console.log('Worker đã sẵn sàng.');

  const shutdown = async () => {
    await Promise.all(parts.map((part) => part.close()));
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

void main();
