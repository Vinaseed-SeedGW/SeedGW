import 'server-only';
import {
  CLOCK_SKEW_FLAG_MINUTES,
  type CheckInFlag,
  type CheckInReceipt,
  type CreateCheckInInput,
  type TrackPointsBatchInput,
  type TrackSessionInput,
} from '@dms/contracts/check-ins';
import { vietnamDayStart, vietnamNextDayStart, vietnamToday } from '@dms/contracts/format';
import {
  cumulativeAt,
  distanceMeters,
  FILTER,
  filterTrack,
  segmentOf,
} from '@dms/contracts/track-distance';
import { db } from '@dms/db/client';
import type { MobileUser } from '@/server/auth/mobile';
import { CHECK_IN_PHOTO_PREFIX, putObject } from '@/server/integrations/object-storage';
import { reverseGeocode } from '@/server/integrations/vietmap';
import { DomainError } from './domain-error';

// Cờ nghi vấn chỉ để quản lý xem, không bao giờ chặn ghi nhận check-in (CLAUDE.md).
const POOR_ACCURACY_FLAG_M = 100;
const MAX_ADDRESS_ATTEMPTS = 5;
// Hai check-in cách nhau xa hơn mức này mà vết GPS ngắn hơn đường chim bay: vết bị đứt, km là ước tính.
const MISSING_TRACK_MIN_M = FILTER.gapMeters;

export function checkInFlags(
  input: Pick<CreateCheckInInput, 'isMocked' | 'accuracyM'>,
  clockSkewMs: number | null,
): CheckInFlag[] {
  const flags: CheckInFlag[] = [];
  if (input.isMocked) flags.push('MOCKED_LOCATION');
  if (input.accuracyM === null || input.accuracyM > POOR_ACCURACY_FLAG_M)
    flags.push('POOR_ACCURACY');
  if (clockSkewMs !== null && Math.abs(clockSkewMs) > CLOCK_SKEW_FLAG_MINUTES * 60_000) {
    flags.push('CLOCK_SKEW');
  }
  return flags;
}

/** Độ lệch giờ máy so với giờ máy chủ, đo bằng giờ máy lúc gửi (không phải lúc chụp, vì có thể gửi trễ). */
export function clockSkewFromHeader(deviceTime: string | null, now = Date.now()): number | null {
  if (!deviceTime) return null;
  const parsed = Date.parse(deviceTime);
  return Number.isNaN(parsed) ? null : parsed - now;
}

/** Gọi lại cùng clientId trả kết quả cũ, không tạo dòng mới (M3). */
export async function saveCheckIn(
  user: MobileUser,
  input: CreateCheckInInput,
  clockSkewMs: number | null,
): Promise<{ receipt: CheckInReceipt; created: boolean; id: string }> {
  const existing = await db.checkIn.findUnique({
    where: { clientId: input.clientId },
    select: { id: true, userId: true, photoKey: true },
  });
  if (existing) {
    if (existing.userId !== user.id) throw new DomainError('CONFLICT', 'Mã check-in đã được dùng');
    return {
      receipt: {
        id: existing.id,
        serverTime: new Date().toISOString(),
        hasPhoto: existing.photoKey !== null,
      },
      created: false,
      id: existing.id,
    };
  }

  const saved = await db.checkIn
    .create({
      data: {
        clientId: input.clientId,
        userId: user.id,
        orgUnitId: user.orgUnitId,
        deviceId: user.deviceId,
        capturedAt: new Date(input.capturedAt),
        lat: input.lat,
        lng: input.lng,
        accuracyM: input.accuracyM,
        isMocked: input.isMocked,
        placeKind: input.placeKind,
        placeName: input.placeName,
        note: input.note,
        addressOnPhoto: input.addressOnPhoto,
        flags: checkInFlags(input, clockSkewMs),
      },
      select: { id: true },
    })
    .catch(async (error: unknown) => {
      // Hai lần gửi cùng lúc: lần sau gặp khoá trùng thì đọc lại dòng đã có.
      const again = await db.checkIn.findUnique({
        where: { clientId: input.clientId },
        select: { id: true, userId: true },
      });
      if (again?.userId === user.id) return { id: again.id };
      throw error;
    });

  return {
    receipt: { id: saved.id, serverTime: new Date().toISOString(), hasPhoto: false },
    created: true,
    id: saved.id,
  };
}

function isJpeg(bytes: Buffer): boolean {
  return bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

export async function saveCheckInPhoto(
  user: MobileUser,
  clientId: string,
  bytes: Buffer,
): Promise<void> {
  const checkIn = await db.checkIn.findUnique({
    where: { clientId },
    select: { id: true, userId: true, capturedAt: true },
  });
  if (!checkIn || checkIn.userId !== user.id) {
    throw new DomainError('NOT_FOUND', 'Chưa có check-in cho ảnh này, app sẽ gửi lại sau');
  }
  if (!isJpeg(bytes)) throw new DomainError('VALIDATION', 'Ảnh check-in phải là JPEG');
  const month = checkIn.capturedAt.toISOString().slice(0, 7).replace('-', '/');
  const key = `${CHECK_IN_PHOTO_PREFIX}${month}/${checkIn.id}.jpg`;
  // Ghi đè cùng tên nên gửi lại nhiều lần vẫn chỉ có một ảnh.
  await putObject(key, bytes, 'image/jpeg');
  await db.checkIn.update({
    where: { id: checkIn.id },
    data: { photoKey: key, photoBytes: bytes.length },
  });
}

export async function saveTrackPoints(
  user: MobileUser,
  input: TrackPointsBatchInput,
): Promise<{ accepted: number; days: string[] }> {
  const result = await db.trackPoint.createMany({
    data: input.points.map((point) => ({
      userId: user.id,
      recordedAt: new Date(point.recordedAt),
      lat: point.lat,
      lng: point.lng,
      accuracyM: point.accuracyM,
      speedMps: point.speedMps,
      isMocked: point.isMocked,
      isBackground: point.isBackground,
    })),
    skipDuplicates: true,
  });
  const days = new Set(input.points.map((point) => vietnamToday(new Date(point.recordedAt))));
  return { accepted: result.count, days: [...days] };
}

export async function saveTrackSession(user: MobileUser, input: TrackSessionInput): Promise<void> {
  const existing = await db.trackSession.findUnique({
    where: { clientId: input.clientId },
    select: { userId: true },
  });
  if (existing && existing.userId !== user.id) {
    throw new DomainError('CONFLICT', 'Mã phiên ghi đã được dùng');
  }
  const data = {
    startedAt: new Date(input.startedAt),
    endedAt: input.endedAt ? new Date(input.endedAt) : null,
    endReason: input.endReason,
  };
  await db.trackSession.upsert({
    where: { clientId: input.clientId },
    create: { clientId: input.clientId, userId: user.id, ...data },
    update: data,
  });
}

/**
 * Tính lại km theo GPS của mọi check-in trong một ngày của một nhân viên (V1). Chạy lại được
 * nhiều lần nên điểm GPS hoặc check-in gửi trễ, lệch thứ tự vẫn ra đúng.
 * Khoảng cách theo đường đi thực tế để trống tới khi có máy chủ tìm đường (R4).
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
      },
    }),
  ]);
  if (checkIns.length === 0) return;

  const starts = sessions.map((session) => session.startedAt.getTime());
  const track = filterTrack(
    points.map((point) => ({
      recordedAt: point.recordedAt.getTime(),
      lat: point.lat,
      lng: point.lng,
      accuracy: point.accuracyM,
      segment: segmentOf(starts, point.recordedAt.getTime()),
    })),
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
    if (checkIn.gpsDistanceKm !== km || checkIn.isDistanceEstimated !== estimated) {
      updates.push(
        db.checkIn.update({
          where: { id: checkIn.id },
          data: { gpsDistanceKm: km, isDistanceEstimated: estimated },
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
    select: { id: true, lat: true, lng: true },
  });
  for (const checkIn of pending) {
    const outcome = await reverseGeocode(checkIn.lat, checkIn.lng);
    await db.checkIn.update({
      where: { id: checkIn.id },
      data: outcome.ok ? { address: outcome.address } : { addressAttempts: { increment: 1 } },
    });
  }
}
