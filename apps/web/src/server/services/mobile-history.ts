import 'server-only';
import {
  checkInFlag,
  earliestCheckInDate,
  type MobileHistoryResult,
} from '@dms/contracts/check-ins';
import { vietnamDayStart, vietnamToday } from '@dms/contracts/format';
import { db } from '@dms/db/client';
import type { MobileUser } from '@/server/auth/mobile';
import { CHECK_IN_PHOTO_RETENTION_DAYS, getObject } from '@/server/integrations/object-storage';
import { DomainError } from './domain-error';

const PHOTO_RETENTION_MS = CHECK_IN_PHOTO_RETENTION_DAYS * 86_400_000;

function nextMonth(month: string): string {
  const [year, value] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year ?? 1970, value ?? 1, 1));
  return date.toISOString().slice(0, 7);
}

/**
 * Check-in của chính nhân viên trong một tháng theo giờ Việt Nam (M6). Chỉ dữ liệu của mình nên lọc
 * thẳng theo id người dùng, không qua phạm vi của quản lý. Không lùi quá thời hạn lưu 18 tháng.
 */
export async function listMyCheckIns(
  user: MobileUser,
  month: string,
  now = new Date(),
): Promise<MobileHistoryResult> {
  const earliest = earliestCheckInDate(vietnamToday(now));
  const earliestMonth = earliest.slice(0, 7);
  const from = new Date(
    Math.max(vietnamDayStart(`${month}-01`).getTime(), vietnamDayStart(earliest).getTime()),
  );
  const to = vietnamDayStart(`${nextMonth(month)}-01`);
  const rows =
    month < earliestMonth
      ? []
      : await db.checkIn.findMany({
          where: { userId: user.id, capturedAt: { gte: from, lt: to } },
          orderBy: { capturedAt: 'asc' },
          select: {
            clientId: true,
            capturedAt: true,
            placeKind: true,
            placeName: true,
            note: true,
            farReason: true,
            address: true,
            addressOnPhoto: true,
            gpsDistanceKm: true,
            isDistanceEstimated: true,
            roadDistanceKm: true,
            isRoadEstimated: true,
            flags: true,
            photoKey: true,
          },
        });
  return {
    month,
    earliestMonth,
    items: rows.map((row) => ({
      clientId: row.clientId,
      capturedAt: row.capturedAt.toISOString(),
      placeKind: row.placeKind,
      placeName: row.placeName,
      note: row.note,
      farReason: row.farReason,
      address: row.address ?? row.addressOnPhoto,
      gpsDistanceKm: row.gpsDistanceKm,
      isDistanceEstimated: row.isDistanceEstimated,
      roadDistanceKm: row.roadDistanceKm,
      isRoadEstimated: row.isRoadEstimated,
      flags: row.flags.flatMap((flag) => {
        const parsed = checkInFlag.safeParse(flag);
        return parsed.success ? [parsed.data] : [];
      }),
      hasPhoto:
        row.photoKey !== null && now.getTime() - row.capturedAt.getTime() < PHOTO_RETENTION_MS,
    })),
  };
}

/** Ảnh check-in của chính mình, qua máy chủ web vì app không gọi thẳng được kho ảnh. */
export async function readMyCheckInPhoto(user: MobileUser, clientId: string): Promise<Buffer> {
  const row = await db.checkIn.findUnique({
    where: { clientId },
    select: { userId: true, photoKey: true, capturedAt: true },
  });
  if (!row || row.userId !== user.id || !row.photoKey) {
    throw new DomainError('NOT_FOUND', 'Không có ảnh cho lượt check-in này');
  }
  if (Date.now() - row.capturedAt.getTime() >= PHOTO_RETENTION_MS) {
    throw new DomainError('NOT_FOUND', 'Ảnh đã hết thời gian lưu 45 ngày');
  }
  const bytes = await getObject(row.photoKey);
  if (!bytes) throw new DomainError('NOT_FOUND', 'Ảnh đã hết thời gian lưu 45 ngày');
  return bytes;
}
