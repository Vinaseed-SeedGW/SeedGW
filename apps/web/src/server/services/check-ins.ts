import 'server-only';
import {
  CLOCK_SKEW_FLAG_MINUTES,
  type CheckInFlag,
  type CheckInReceipt,
  type CreateCheckInInput,
  type TrackPointsBatchInput,
  type TrackSessionInput,
} from '@seedgw/contracts/check-ins';
import { isSameStreet, PROPOSAL_MAX_ACCURACY_M } from '@seedgw/contracts/dealer-locations';
import { vietnamToday } from '@seedgw/contracts/format';
import { distanceMeters } from '@seedgw/contracts/track-distance';
import { db } from '@seedgw/db/client';
import type { MobileUser } from '@/server/auth/mobile';
import { CHECK_IN_PHOTO_PREFIX, putObject } from '@/server/integrations/object-storage';
import { DomainError } from './domain-error';
import { markCustomerVisited, resolveCheckInCustomer } from './mobile-customers';
import { resolveCheckInDealer, type CheckInDealer } from './mobile-dealers';
import { readSystemSettings } from './settings';

// Cờ nghi vấn chỉ để quản lý xem, không bao giờ chặn ghi nhận check-in (CLAUDE.md).
const POOR_ACCURACY_FLAG_M = 100;

export function checkInFlags(
  input: Pick<CreateCheckInInput, 'isMocked' | 'accuracyM' | 'deviceIntegrity'>,
  clockSkewMs: number | null,
): CheckInFlag[] {
  const flags: CheckInFlag[] = [];
  if (input.isMocked) flags.push('MOCKED_LOCATION');
  if (input.deviceIntegrity === 'ROOTED') flags.push('ROOTED_DEVICE');
  if (input.accuracyM === null || input.accuracyM > POOR_ACCURACY_FLAG_M)
    flags.push('POOR_ACCURACY');
  if (clockSkewMs !== null && Math.abs(clockSkewMs) > CLOCK_SKEW_FLAG_MINUTES * 60_000) {
    flags.push('CLOCK_SKEW');
  }
  return flags;
}

/**
 * Kiểm tra đúng đại lý (M4). Đại lý có toạ độ đã duyệt thì so khoảng cách với bán kính trong Tham số;
 * chưa có toạ độ thì so tên phố trong địa chỉ lúc chụp với địa chỉ trong danh mục. Chỉ gắn cờ, không chặn.
 */
export function dealerCheck(
  dealer: Pick<CheckInDealer, 'lat' | 'lng' | 'address'> | null,
  point: { lat: number; lng: number },
  address: string | null,
  radiusM: number,
): { flags: CheckInFlag[]; distanceM: number | null } {
  if (!dealer) return { flags: [], distanceM: null };
  if (dealer.lat !== null && dealer.lng !== null) {
    const distanceM = Math.round(distanceMeters(point, { lat: dealer.lat, lng: dealer.lng }));
    return { flags: distanceM > radiusM ? ['FAR_FROM_DEALER'] : [], distanceM };
  }
  return {
    flags: isSameStreet(address, dealer.address) === false ? ['STREET_MISMATCH'] : [],
    distanceM: null,
  };
}

/** Lần check-in tại đại lý chưa có toạ độ, vị trí đủ tin cậy thì đề xuất toạ độ cho Quản trị đơn vị duyệt. */
export function shouldProposeLocation(
  dealer: Pick<CheckInDealer, 'lat' | 'lng'> | null,
  input: Pick<CreateCheckInInput, 'isMocked' | 'accuracyM'>,
): boolean {
  return (
    dealer !== null &&
    (dealer.lat === null || dealer.lng === null) &&
    !input.isMocked &&
    input.accuracyM !== null &&
    input.accuracyM <= PROPOSAL_MAX_ACCURACY_M
  );
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

  const [dealer, customer, settings] = await Promise.all([
    resolveCheckInDealer(user, input),
    resolveCheckInCustomer(user, input),
    readSystemSettings(),
  ]);
  const check = dealerCheck(dealer, input, input.addressOnPhoto, settings.values.checkInRadiusM);

  // M5: lưu tình trạng máy app báo về để Quản trị thấy ở danh sách thiết bị. App cũ không gửi thì bỏ qua.
  if (input.deviceIntegrity !== 'UNKNOWN') {
    await db.mobileDevice.update({
      where: { id: user.deviceId },
      data: { isRooted: input.deviceIntegrity === 'ROOTED', integrityCheckedAt: new Date() },
    });
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
        dealerId: dealer?.id ?? null,
        customerId: customer?.id ?? null,
        dealerDistanceM: check.distanceM,
        farReason: input.farReason || null,
        flags: [...checkInFlags(input, clockSkewMs), ...check.flags],
        // M10: đề xuất đại lý mới ghi cùng câu lệnh với check-in nên không có check-in nào mất đề xuất.
        // Tài khoản không có quyền đề xuất thì vẫn lưu check-in, bỏ phần đề xuất.
        ...(input.newDealer && user.permissions.has('sales.dealer.propose')
          ? {
              dealerProposal: {
                create: {
                  orgUnitId: user.orgUnitId,
                  proposedById: user.id,
                  name: input.newDealer.name,
                  phone: input.newDealer.phone,
                  address: input.newDealer.address,
                  ownerName: input.newDealer.ownerName,
                  taxCode: input.newDealer.taxCode,
                  level: input.newDealer.level,
                },
              },
            }
          : {}),
      },
      select: { id: true },
    })
    .catch(async (error: unknown) => {
      // Hai lần gửi cùng lúc: lần sau gặp khoá trùng thì đọc lại dòng đã có.
      const again = await db.checkIn.findUnique({
        where: { clientId: input.clientId },
        select: { id: true, userId: true },
      });
      if (again?.userId === user.id) return { id: again.id, duplicate: true };
      throw error;
    });

  // Lần ghé gần nhất của đại lý cho dashboard (K0). Lượt gửi trễ, cũ hơn lượt đã có thì không ghi đè.
  if (!('duplicate' in saved) && dealer) {
    const capturedAt = new Date(input.capturedAt);
    await db.dealer.updateMany({
      where: {
        id: dealer.id,
        OR: [{ lastVisitedAt: null }, { lastVisitedAt: { lt: capturedAt } }],
      },
      data: { lastVisitedAt: capturedAt },
    });
  }

  if (!('duplicate' in saved) && customer) {
    await markCustomerVisited(customer, {
      capturedAt: new Date(input.capturedAt),
      lat: input.lat,
      lng: input.lng,
    });
  }

  if (!('duplicate' in saved) && dealer && shouldProposeLocation(dealer, input)) {
    await db.dealerLocationProposal
      .create({
        data: {
          dealerId: dealer.id,
          orgUnitId: dealer.orgUnitId,
          checkInId: saved.id,
          proposedById: user.id,
          lat: input.lat,
          lng: input.lng,
          accuracyM: input.accuracyM,
        },
      })
      // Đại lý đã có đề xuất chờ duyệt (khoá duy nhất có điều kiện): giữ đề xuất cũ.
      .catch((error: unknown) => {
        if (!isUniqueViolation(error)) throw error;
      });
  }

  return {
    receipt: { id: saved.id, serverTime: new Date().toISOString(), hasPhoto: false },
    created: true,
    id: saved.id,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
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
