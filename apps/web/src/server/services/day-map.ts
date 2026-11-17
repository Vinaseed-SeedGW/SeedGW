import 'server-only';
import {
  checkInFlag,
  type DayMapCheckIn,
  type DayMapResult,
  type LatLng,
} from '@dms/contracts/check-ins';
import { vietnamDayStart, vietnamNextDayStart, vietnamToday } from '@dms/contracts/format';
import {
  distanceMeters,
  filterTrack,
  FILTER,
  segmentOf,
  type KeptPoint,
} from '@dms/contracts/track-distance';
import { trackFilterOf, trackingSettingsFrom } from '@dms/contracts/tracking-settings';
import { getScopedDb } from '@/server/auth/scoped-db';
import { CHECK_IN_PHOTO_RETENTION_DAYS, presignGetUrl } from '@/server/integrations/object-storage';
import { readSystemSettings } from './settings';

const DAY_MS = 86_400_000;
// Vết GPS thô giữ 45 ngày như ảnh (CHECK_IN_PLAN, thời gian lưu).
const TRACK_RETENTION_DAYS = CHECK_IN_PHOTO_RETENTION_DAYS;
// Rút gọn vết cho trang nhẹ; 2.000 điểm vẫn đủ mịn ở mọi mức phóng to của một ngày đi thị trường.
const MAX_LINE_POINTS = 2_000;

function toLatLng(point: { lat: number; lng: number }): LatLng {
  return [Math.round(point.lat * 1e6) / 1e6, Math.round(point.lng * 1e6) / 1e6];
}

/** Tách vết thành các đoạn liền: sang phiên ghi mới hoặc đứt quá 5 phút và quá 300 m thì tách. */
function splitLines(kept: readonly KeptPoint[]): { lines: LatLng[][]; gaps: [LatLng, LatLng][] } {
  const step = Math.max(1, Math.ceil(kept.length / MAX_LINE_POINTS));
  const lines: LatLng[][] = [];
  const gaps: [LatLng, LatLng][] = [];
  let current: LatLng[] = [];
  let previous: KeptPoint | null = null;
  kept.forEach((point, index) => {
    const broken =
      previous !== null &&
      (previous.segment !== point.segment ||
        ((point.recordedAt - previous.recordedAt) / 60_000 > FILTER.gapMinutes &&
          distanceMeters(previous, point) > FILTER.gapMeters));
    if (broken && previous) {
      current.push(toLatLng(previous));
      lines.push(current);
      gaps.push([toLatLng(previous), toLatLng(point)]);
      current = [];
    }
    // Giữ điểm đầu, điểm cuối mỗi đoạn và cứ step điểm lấy một.
    if (broken || current.length === 0 || index % step === 0 || index === kept.length - 1) {
      current.push(toLatLng(point));
    }
    previous = point;
  });
  if (current.length > 0) lines.push(current);
  return { lines: lines.filter((line) => line.length > 1), gaps };
}

/**
 * Hành trình một ngày của một nhân viên, chỉ trong phạm vi dữ liệu của người xem (V2b). Trả null khi
 * nhân viên không có hoặc nằm ngoài phạm vi. Km dùng đúng cách lọc của báo cáo nên khớp file Excel.
 */
export async function readDayMap(
  employeeCode: string,
  day: string,
  now = new Date(),
): Promise<DayMapResult | null> {
  const scoped = await getScopedDb();
  const employee = await scoped.user.findFirst({
    where: { employeeCode },
    select: { id: true, employeeCode: true, fullName: true, orgUnit: { select: { name: true } } },
  });
  if (!employee) return null;

  const from = vietnamDayStart(day);
  const to = vietnamNextDayStart(day);
  const ageDays = (vietnamDayStart(vietnamToday(now)).getTime() - from.getTime()) / DAY_MS;
  const trackAvailable = ageDays <= TRACK_RETENTION_DAYS;

  const [points, sessions, checkIns] = await Promise.all([
    trackAvailable
      ? scoped.trackPoint.findMany({
          where: { userId: employee.id, recordedAt: { gte: from, lt: to } },
          orderBy: { recordedAt: 'asc' },
          select: { recordedAt: true, lat: true, lng: true, accuracyM: true },
        })
      : Promise.resolve([]),
    scoped.trackSession.findMany({
      where: {
        userId: employee.id,
        startedAt: { lt: to },
        OR: [{ endedAt: null }, { endedAt: { gte: from } }],
      },
      orderBy: { startedAt: 'asc' },
      select: { startedAt: true },
    }),
    scoped.checkIn.findMany({
      where: { userId: employee.id, capturedAt: { gte: from, lt: to } },
      orderBy: { capturedAt: 'asc' },
      select: {
        id: true,
        capturedAt: true,
        placeKind: true,
        placeName: true,
        address: true,
        addressOnPhoto: true,
        lat: true,
        lng: true,
        accuracyM: true,
        gpsDistanceKm: true,
        isDistanceEstimated: true,
        flags: true,
        farReason: true,
        dealerDistanceM: true,
        photoKey: true,
        dealer: { select: { name: true, lat: true, lng: true } },
      },
    }),
  ]);

  const starts = sessions.map((session) => session.startedAt.getTime());
  const settings = await readSystemSettings();
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
  const { lines, gaps } = splitLines(track.kept);
  const first = track.kept[0];
  const last = track.kept.at(-1);
  const photoAlive = ageDays < CHECK_IN_PHOTO_RETENTION_DAYS;

  const mapped: DayMapCheckIn[] = checkIns.map((row, index) => ({
    id: row.id,
    order: index + 1,
    capturedAt: row.capturedAt.toISOString(),
    placeKind: row.placeKind,
    placeName: row.placeName,
    address: row.address ?? row.addressOnPhoto,
    lat: row.lat,
    lng: row.lng,
    accuracyM: row.accuracyM,
    gpsDistanceKm: row.gpsDistanceKm,
    isDistanceEstimated: row.isDistanceEstimated,
    flags: row.flags.flatMap((flag) => {
      const parsed = checkInFlag.safeParse(flag);
      return parsed.success ? [parsed.data] : [];
    }),
    farReason: row.farReason,
    dealerDistanceM: row.dealerDistanceM,
    dealer:
      row.dealer && row.dealer.lat !== null && row.dealer.lng !== null
        ? { name: row.dealer.name, lat: row.dealer.lat, lng: row.dealer.lng }
        : null,
    photoUrl: photoAlive && row.photoKey ? presignGetUrl(row.photoKey) : null,
  }));

  return {
    employee: {
      code: employee.employeeCode,
      name: employee.fullName,
      orgUnitName: employee.orgUnit?.name ?? null,
    },
    day,
    lines,
    gaps,
    start: first ? { at: new Date(first.recordedAt).toISOString(), point: toLatLng(first) } : null,
    end: last ? { at: new Date(last.recordedAt).toISOString(), point: toLatLng(last) } : null,
    trackAvailable,
    pointCount: points.length,
    trackKm: Math.round(track.distanceM) / 1000,
    checkInKm:
      Math.round(mapped.reduce((sum, row) => sum + (row.gpsDistanceKm ?? 0), 0) * 1000) / 1000,
    checkIns: mapped,
  };
}
