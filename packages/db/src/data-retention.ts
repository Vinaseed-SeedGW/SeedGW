import { db } from './client';

// D5: giữ dữ liệu theo DESIGN_BRIEF quyết định 22: điểm GPS thô 45 ngày, dòng check-in 18 tháng (ảnh có luật
// tự xoá 45 ngày ở kho ảnh). Worker chạy mỗi đêm. Bảng điểm GPS chia theo tháng nên bỏ cả tháng cũ rất nhanh.

const DAY_MS = 86_400_000;
export const TRACK_RETENTION_DAYS = 45;
export const CHECK_IN_RETENTION_DAYS = 548;
const MONTHS_AHEAD = 2;
const CHECK_IN_BATCH = 5_000;
const PARTITION_NAME = /^track_points_(\d{4})_(\d{2})$/;

function monthStart(year: number, monthIndex: number): Date {
  return new Date(Date.UTC(year, monthIndex, 1));
}

function partitionName(start: Date): string {
  return `track_points_${start.getUTCFullYear()}_${String(start.getUTCMonth() + 1).padStart(2, '0')}`;
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/** Tạo sẵn bảng tháng hiện tại và 2 tháng sau, chạy lại nhiều lần không sao. */
export async function ensureTrackPointPartitions(now: Date = new Date()): Promise<string[]> {
  const created: string[] = [];
  for (let offset = 0; offset <= MONTHS_AHEAD; offset += 1) {
    const start = monthStart(now.getUTCFullYear(), now.getUTCMonth() + offset);
    const end = monthStart(start.getUTCFullYear(), start.getUTCMonth() + 1);
    const name = partitionName(start);
    // Tên bảng, ngày ghép từ số do máy chủ tính, không có dữ liệu người dùng.
    await db.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "${name}" PARTITION OF "track_points" FOR VALUES FROM ('${isoDate(start)}') TO ('${isoDate(end)}')`,
    );
    created.push(name);
  }
  return created;
}

export type RetentionResult = {
  droppedPartitions: string[];
  deletedTrackPoints: number;
  deletedTrackSessions: number;
  deletedCheckIns: number;
};

/** Bỏ dữ liệu quá hạn. Tháng nằm trọn trước mốc 45 ngày thì bỏ cả bảng tháng, phần còn lại xoá theo dòng. */
export async function purgeExpiredTrackingData(now: Date = new Date()): Promise<RetentionResult> {
  const trackCutoff = new Date(now.getTime() - TRACK_RETENTION_DAYS * DAY_MS);
  const checkInCutoff = new Date(now.getTime() - CHECK_IN_RETENTION_DAYS * DAY_MS);

  const partitions = await db.$queryRaw<Array<{ name: string }>>`
    SELECT c.relname AS name FROM pg_inherits i
    JOIN pg_class c ON c.oid = i.inhrelid
    JOIN pg_class p ON p.oid = i.inhparent
    WHERE p.relname = 'track_points'
  `;
  const droppedPartitions: string[] = [];
  for (const { name } of partitions) {
    const match = PARTITION_NAME.exec(name);
    if (!match?.[1] || !match[2]) continue;
    const end = monthStart(Number(match[1]), Number(match[2]));
    if (end.getTime() <= trackCutoff.getTime()) {
      await db.$executeRawUnsafe(`DROP TABLE IF EXISTS "${name}"`);
      droppedPartitions.push(name);
    }
  }

  const [points, sessions] = await Promise.all([
    db.trackPoint.deleteMany({ where: { recordedAt: { lt: trackCutoff } } }),
    db.trackSession.deleteMany({ where: { startedAt: { lt: trackCutoff } } }),
  ]);

  // Dòng check-in quá 18 tháng: xoá từng đợt để không khoá bảng lâu. Bảng gộp theo ngày vẫn giữ số liệu.
  let deletedCheckIns = 0;
  for (;;) {
    const batch = await db.checkIn.findMany({
      where: { capturedAt: { lt: checkInCutoff } },
      select: { id: true },
      take: CHECK_IN_BATCH,
    });
    if (batch.length === 0) break;
    const { count } = await db.checkIn.deleteMany({
      where: { id: { in: batch.map((row) => row.id) } },
    });
    deletedCheckIns += count;
    if (batch.length < CHECK_IN_BATCH) break;
  }

  return {
    droppedPartitions,
    deletedTrackPoints: points.count,
    deletedTrackSessions: sessions.count,
    deletedCheckIns,
  };
}
