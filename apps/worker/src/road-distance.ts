import { buildRoadLegs } from '@seedgw/contracts/road-distance';
import { resolveSystemSettings } from '@seedgw/contracts/settings';
import { filterTrack, segmentOf } from '@seedgw/contracts/track-distance';
import { trackFilterOf, trackingSettingsFrom } from '@seedgw/contracts/tracking-settings';
import { db } from '@seedgw/db/client';
import type { RoadDistanceProvider } from './osrm';

const GENERAL_SETTINGS_KEY = 'general';
const DAY_MS = 86_400_000;

function dayBounds(day: string): { from: Date; to: Date } {
  const from = new Date(`${day}T00:00:00+07:00`);
  return { from, to: new Date(from.getTime() + DAY_MS) };
}

export type RoadDayResult = { checkIns: number; legs: number; estimated: number; ms: number };

/**
 * Km theo đường đi của từng lượt check-in trong một ngày của một nhân viên (V1b). Lượt đầu ngày bằng 0.
 * Chặng dùng vết GPS đã lọc theo Tham số; chặng không có điểm GPS nào thì là đường ngắn nhất giữa hai lượt,
 * ghi ước tính. Tính lại cả ngày mỗi lần vì check-in mất mạng có thể tới muộn và chen vào giữa.
 */
export async function computeRoadDay(
  provider: RoadDistanceProvider,
  userId: string,
  day: string,
): Promise<RoadDayResult> {
  const started = Date.now();
  const { from, to } = dayBounds(day);
  const [setting, points, sessions, checkIns] = await Promise.all([
    db.systemSetting.findUnique({ where: { key: GENERAL_SETTINGS_KEY }, select: { value: true } }),
    db.trackPoint.findMany({
      where: { userId, recordedAt: { gte: from, lt: to } },
      orderBy: { recordedAt: 'asc' },
      select: { recordedAt: true, lat: true, lng: true, accuracyM: true },
    }),
    db.trackSession.findMany({
      where: { userId, startedAt: { lt: to }, OR: [{ endedAt: null }, { endedAt: { gte: from } }] },
      orderBy: { startedAt: 'asc' },
      select: { startedAt: true },
    }),
    db.checkIn.findMany({
      where: { userId, capturedAt: { gte: from, lt: to } },
      orderBy: { capturedAt: 'asc' },
      select: { id: true, capturedAt: true, lat: true, lng: true },
    }),
  ]);
  if (checkIns.length === 0) return { checkIns: 0, legs: 0, estimated: 0, ms: 0 };

  const filter = trackFilterOf(trackingSettingsFrom(resolveSystemSettings(setting?.value)));
  const starts = sessions.map((session) => session.startedAt.getTime());
  const track = filterTrack(
    points.map((point) => ({
      recordedAt: point.recordedAt.getTime(),
      lat: point.lat,
      lng: point.lng,
      accuracy: point.accuracyM,
      segment: segmentOf(starts, point.recordedAt.getTime()),
    })),
    filter,
  );
  const kept = track.kept.map((point) => ({
    recordedAt: point.recordedAt,
    lat: point.lat,
    lng: point.lng,
    accuracy: null,
  }));
  const legs = buildRoadLegs(
    checkIns.map((checkIn) => ({
      id: checkIn.id,
      capturedAt: checkIn.capturedAt.getTime(),
      lat: checkIn.lat,
      lng: checkIn.lng,
    })),
    kept,
  );

  const now = new Date();
  const results = new Map<string, { km: number; estimated: boolean }>();
  const first = checkIns[0];
  if (first) results.set(first.id, { km: 0, estimated: false });
  for (const leg of legs) {
    const road = await provider.legDistance(leg.points);
    results.set(leg.checkInId, {
      km: Math.round(road.meters) / 1000,
      estimated: road.estimated || leg.trackPoints === 0,
    });
  }
  await db.$transaction(
    [...results.entries()].map(([id, value]) =>
      db.checkIn.update({
        where: { id },
        data: { roadDistanceKm: value.km, isRoadEstimated: value.estimated, roadComputedAt: now },
      }),
    ),
  );
  return {
    checkIns: checkIns.length,
    legs: legs.length,
    estimated: [...results.values()].filter((value) => value.estimated).length,
    ms: Date.now() - started,
  };
}

/** Các cặp nhân viên, ngày có check-in trong khoảng thời gian, dùng cho lần chốt 21:00 và điền ngày cũ. */
export async function userDaysWithCheckIns(
  from: Date,
  to: Date,
): Promise<Array<{ userId: string; day: string }>> {
  // Cột lưu giờ UTC không kèm múi giờ: phải gắn UTC trước rồi mới đổi sang giờ Việt Nam.
  const rows = await db.$queryRaw<Array<{ user_id: string; day: string }>>`
    SELECT DISTINCT user_id,
      to_char((captured_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') AS day
    FROM check_ins WHERE captured_at >= ${from} AND captured_at < ${to}
  `;
  return rows.map((row) => ({ userId: row.user_id, day: row.day }));
}
