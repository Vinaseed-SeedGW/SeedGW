import 'server-only';
import type { Prisma } from '@prisma/client';
import {
  LOCATION_CONSENT_KIND,
  LOCATION_CONSENT_VERSION,
  renderConsentText,
  type ConsentAction,
  type ConsentChannel,
  type ConsentRecordView,
  type MobileConsentStatus,
} from '@seedgw/contracts/consents';
import { db } from '@seedgw/db/client';
import { appendConsentRecord } from '@seedgw/db/consent-ledger';

// Lời đồng ý chỉ của chính người dùng, nên đọc ghi theo id người đang đăng nhập, không qua phạm vi dữ liệu.
// 25/11/2026: mỗi lần đồng ý hay rút lại ghi thêm một dòng vào sổ đồng ý (bằng chứng), cùng giao dịch với
// trạng thái hiện tại ở user_consents.
const CURRENT = { kind: LOCATION_CONSENT_KIND, version: LOCATION_CONSENT_VERSION };

/** Thông tin kèm theo lần bấm: IP, trình duyệt (web) hoặc máy đang đăng nhập (app). */
export type ConsentMeta = {
  channel: ConsentChannel;
  ip: string | null;
  userAgent: string | null;
  deviceId: string | null;
};

export async function readLocationConsent(userId: string): Promise<MobileConsentStatus> {
  const row = await db.userConsent.findUnique({
    where: { userId_kind_version: { userId, ...CURRENT } },
    select: { acceptedAt: true, withdrawnAt: true },
  });
  const accepted = row !== null && row.withdrawnAt === null;
  return {
    version: LOCATION_CONSENT_VERSION,
    accepted,
    acceptedAt: accepted ? row.acceptedAt.toISOString() : null,
  };
}

async function writeLedger(
  tx: Prisma.TransactionClient,
  userId: string,
  action: ConsentAction,
  meta: ConsentMeta,
  at: Date,
): Promise<void> {
  const contentText = renderConsentText(CURRENT.kind, CURRENT.version);
  if (!contentText) throw new Error('Thiếu nội dung lời đồng ý của phiên bản hiện tại');
  const [user, device] = await Promise.all([
    tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { employeeCode: true, fullName: true },
    }),
    meta.deviceId
      ? tx.mobileDevice.findUnique({
          where: { id: meta.deviceId },
          select: { name: true, platform: true },
        })
      : null,
  ]);
  await appendConsentRecord(tx, {
    userId,
    employeeCode: user.employeeCode,
    fullName: user.fullName,
    ...CURRENT,
    action,
    channel: meta.channel,
    ip: meta.ip,
    userAgent: meta.userAgent ? meta.userAgent.slice(0, 500) : null,
    deviceName: device?.name ?? null,
    devicePlatform: device?.platform ?? null,
    contentText,
    recordedAt: at,
  });
}

/** Trả true khi đây là lần đồng ý mới (để ghi nhật ký), false khi đã đồng ý từ trước. */
export async function acceptLocationConsent(userId: string, meta: ConsentMeta): Promise<boolean> {
  const current = await readLocationConsent(userId);
  if (current.accepted) return false;
  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.userConsent.upsert({
      where: { userId_kind_version: { userId, ...CURRENT } },
      create: { userId, ...CURRENT, channel: meta.channel, ip: meta.ip, acceptedAt: now },
      update: { channel: meta.channel, ip: meta.ip, acceptedAt: now, withdrawnAt: null },
    });
    await writeLedger(tx, userId, 'ACCEPT', meta, now);
  });
  return true;
}

/** Trả true khi có lời đồng ý để rút lại. */
export async function withdrawLocationConsent(userId: string, meta: ConsentMeta): Promise<boolean> {
  const now = new Date();
  return db.$transaction(async (tx) => {
    const result = await tx.userConsent.updateMany({
      where: { userId, ...CURRENT, withdrawnAt: null },
      data: { withdrawnAt: now },
    });
    if (result.count === 0) return false;
    await writeLedger(tx, userId, 'WITHDRAW', meta, now);
    return true;
  });
}

export const CONSENT_RECORD_SELECT = {
  id: true,
  seq: true,
  employeeCode: true,
  fullName: true,
  kind: true,
  version: true,
  action: true,
  channel: true,
  ip: true,
  userAgent: true,
  deviceName: true,
  devicePlatform: true,
  contentText: true,
  contentHash: true,
  prevHash: true,
  recordHash: true,
  recordedAt: true,
  migrated: true,
} satisfies Prisma.ConsentRecordSelect;

export function toConsentRecordView(
  row: Prisma.ConsentRecordGetPayload<{ select: typeof CONSENT_RECORD_SELECT }>,
): ConsentRecordView {
  return {
    ...row,
    seq: row.seq.toString(),
    recordedAt: row.recordedAt.toISOString(),
  };
}

/** Sổ đồng ý của chính người dùng, mới nhất lên đầu. */
export async function listOwnConsentRecords(userId: string): Promise<ConsentRecordView[]> {
  const rows = await db.consentRecord.findMany({
    where: { userId },
    orderBy: { seq: 'desc' },
    take: 100,
    select: CONSENT_RECORD_SELECT,
  });
  return rows.map(toConsentRecordView);
}
