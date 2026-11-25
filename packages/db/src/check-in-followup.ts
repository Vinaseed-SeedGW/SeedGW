import { speedFlaggedIds } from '@seedgw/contracts/check-in-speed';
import { isSameStreet } from '@seedgw/contracts/dealer-locations';
import { vietnamDayStart, vietnamNextDayStart } from '@seedgw/contracts/format';
import { resolveSystemSettings } from '@seedgw/contracts/settings';
import {
  cumulativeAt,
  distanceMeters,
  FILTER,
  filterTrack,
  segmentOf,
} from '@seedgw/contracts/track-distance';
import { trackFilterOf, trackingSettingsFrom } from '@seedgw/contracts/tracking-settings';
import { db } from './client';
import { reverseGeocode } from './vietmap';

// F8: việc làm sau khi nhận check-in, điểm GPS: tính km theo GPS, cờ tốc độ, lấy địa chỉ. Worker chạy qua hàng
// đợi có thử lại; web chỉ chạy thẳng khi không có Redis (máy dev). Cả hai hàm chạy lại nhiều lần vẫn ra đúng.

const MAX_ADDRESS_ATTEMPTS = 5;
// Hai check-in cách nhau xa hơn mức này mà vết GPS ngắn hơn đường chim bay: vết bị đứt, km là ước tính.
const MISSING_TRACK_MIN_M = FILTER.gapMeters;
const GENERAL_SETTINGS_KEY = 'general';

async function readSettings() {
  const row = await db.systemSetting.findUnique({ where: { key: GENERAL_SETTINGS_KEY } });
  return { values: resolveSystemSettings(row?.value ?? {}) };
}

/**
 * Tính lại km theo GPS của mọi check-in trong một ngày của một nhân viên (V1). Chạy lại được
 * nhiều lần nên điểm GPS hoặc check-in gửi trễ, lệch thứ tự vẫn ra đúng.
 * Km theo đường đi (V1b) do worker tính sau, người gọi tự hẹn lịch.
 */
export async function recomputeDayDistances(userId: string, day: string): Promise<void> {
  const from = vietnamDayStart(day);
  const to = vietnamNextDayStart(day);
  const [points, sessions, checkIns] = await Promise.all([
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
      select: {
        id: true,
        capturedAt: true,
        lat: true,
        lng: true,
        gpsDistanceKm: true,
        isDistanceEstimated: true,
        flags: true,
      },
    }),
  ]);
  if (checkIns.length === 0) return;
  // M5: tính lại cờ tốc độ cho cả ngày, vì check-in mất mạng có thể tới muộn và chen vào giữa.
  const settings = await readSettings();
  const tooFast = speedFlaggedIds(
    checkIns.map((checkIn) => ({
      id: checkIn.id,
      capturedAt: checkIn.capturedAt.getTime(),
      lat: checkIn.lat,
      lng: checkIn.lng,
    })),
    settings.values.maxCheckInSpeedKmh,
  );

  const starts = sessions.map((session) => session.startedAt.getTime());
  const track = filterTrack(
    points.map((point) => ({
      recordedAt: point.recordedAt.getTime(),
      lat: point.lat,
      lng: point.lng,
      accuracy: point.accuracyM,
      segment: segmentOf(starts, point.recordedAt.getTime()),
    })),
    trackFilterOf(trackingSettingsFrom(settings.values)),
  );

  const updates = [];
  let previous: (typeof checkIns)[number] | null = null;
  let previousCumulative = 0;
  for (const checkIn of checkIns) {
    const cumulative = cumulativeAt(track.kept, checkIn.capturedAt.getTime());
    let meters = 0;
    let estimated = false;
    if (previous) {
      meters = Math.max(0, cumulative - previousCumulative);
      const straight = distanceMeters(previous, checkIn);
      // Thiếu vết giữa hai lượt (tắt app, hết pin): lấy đường chim bay làm mức tối thiểu, đánh dấu ước tính.
      if (straight > MISSING_TRACK_MIN_M && meters < straight * 0.9) {
        meters = straight;
        estimated = true;
      }
    }
    const km = Math.round(meters) / 1000;
    const hadSpeedFlag = checkIn.flags.includes('IMPOSSIBLE_SPEED');
    const hasSpeedFlag = tooFast.has(checkIn.id);
    if (
      checkIn.gpsDistanceKm !== km ||
      checkIn.isDistanceEstimated !== estimated ||
      hadSpeedFlag !== hasSpeedFlag
    ) {
      const flags = checkIn.flags.filter((flag) => flag !== 'IMPOSSIBLE_SPEED');
      if (hasSpeedFlag) flags.push('IMPOSSIBLE_SPEED');
      updates.push(
        db.checkIn.update({
          where: { id: checkIn.id },
          data: { gpsDistanceKm: km, isDistanceEstimated: estimated, flags },
        }),
      );
    }
    previous = checkIn;
    previousCumulative = cumulative;
  }
  if (updates.length > 0) await db.$transaction(updates);
}

/** Lấy địa chỉ cho check-in còn thiếu của nhân viên. Lỗi thì để lần sau thử lại, báo cáo vẫn có toạ độ. */
export async function fillMissingAddresses(userId: string, limit = 5): Promise<void> {
  const pending = await db.checkIn.findMany({
    where: { userId, address: null, addressAttempts: { lt: MAX_ADDRESS_ATTEMPTS } },
    orderBy: { capturedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      lat: true,
      lng: true,
      flags: true,
      dealer: { select: { address: true, lat: true, lng: true } },
    },
  });
  for (const checkIn of pending) {
    const outcome = await reverseGeocode(checkIn.lat, checkIn.lng);
    if (!outcome.ok) {
      await db.checkIn.update({
        where: { id: checkIn.id },
        data: { addressAttempts: { increment: 1 } },
      });
      continue;
    }
    // So lại tên phố bằng địa chỉ máy chủ lấy, không chỉ tin địa chỉ app in lên ảnh.
    const flags = checkIn.flags.filter((flag) => flag !== 'STREET_MISMATCH');
    if (
      checkIn.dealer &&
      checkIn.dealer.lat === null &&
      isSameStreet(outcome.address, checkIn.dealer.address) === false
    ) {
      flags.push('STREET_MISMATCH');
    }
    await db.checkIn.update({
      where: { id: checkIn.id },
      data: { address: outcome.address, flags },
    });
  }
}

const SWEEP_LOOKBACK_MS = 3 * 86_400_000;

/** Quét định kỳ: nhân viên có check-in 3 ngày gần đây còn thiếu địa chỉ (Vietmap lỗi lúc nhận). */
export async function usersMissingAddresses(limit = 50): Promise<string[]> {
  const rows = await db.checkIn.findMany({
    where: {
      address: null,
      addressAttempts: { lt: MAX_ADDRESS_ATTEMPTS },
      capturedAt: { gte: new Date(Date.now() - SWEEP_LOOKBACK_MS) },
    },
    distinct: ['userId'],
    take: limit,
    select: { userId: true },
  });
  return rows.map((row) => row.userId);
}
