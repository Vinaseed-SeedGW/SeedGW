import { Queue, Worker, type Job } from 'bullmq';
import { ROAD_DISTANCE_QUEUE, type RoadDistanceJob } from '@dms/contracts/road-distance';
import { roadDistanceProvider } from './osrm';
import { computeRoadDay, userDaysWithCheckIns } from './road-distance';

// V1b (18/11/2026): job đầu tiên của worker, tính km theo đường đi qua máy chủ tìm đường OSRM nội bộ.
const REDIS_URL = process.env.REDIS_URL?.trim();
const NIGHTLY_SCHEDULER = 'road-distance-nightly';
const DAY_MS = 86_400_000;

const vnToday = () => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);

async function main() {
  const provider = roadDistanceProvider();
  if (!REDIS_URL || !provider) {
    console.log(
      'Worker chạy không có hàng đợi km theo đường: thiếu REDIS_URL hoặc OSRM_URL. Báo cáo chỉ có km theo GPS.',
    );
    setInterval(() => undefined, 60_000);
    return;
  }
  const connection = { url: REDIS_URL, maxRetriesPerRequest: null };
  const queue = new Queue(ROAD_DISTANCE_QUEUE, { connection });

  // Chốt lại cả ngày lúc 21:00 giờ Việt Nam, sau giờ tự dừng ghi hành trình.
  await queue.upsertJobScheduler(
    NIGHTLY_SCHEDULER,
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
        const today = vnToday();
        const from = new Date(`${today}T00:00:00+07:00`);
        const pairs = await userDaysWithCheckIns(from, new Date(from.getTime() + DAY_MS));
        for (const pair of pairs) await computeRoadDay(provider, pair.userId, pair.day);
        return { days: pairs.length };
      }
      const data = job.data as RoadDistanceJob;
      return computeRoadDay(provider, data.userId, data.day);
    },
    { connection, concurrency: 2 },
  );
  worker.on('completed', (job, result) =>
    console.log(`Km theo đường: xong ${job.name} ${job.id}`, JSON.stringify(result)),
  );
  worker.on('failed', (job, error) =>
    console.error(
      `Km theo đường: lỗi ${job?.name} ${job?.id}, lần ${job?.attemptsMade}`,
      error.message,
    ),
  );
  console.log('Worker đã sẵn sàng: hàng đợi km theo đường.');

  const shutdown = async () => {
    await worker.close();
    await queue.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

void main();
