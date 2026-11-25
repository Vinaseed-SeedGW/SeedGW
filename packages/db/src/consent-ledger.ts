import { createHash } from 'node:crypto';
import type { ConsentAction, ConsentChannel, Prisma } from '@prisma/client';
import { renderConsentText } from '@seedgw/contracts/consents';
import { db } from './client';

// Sổ đồng ý dữ liệu cá nhân (25/11/2026). Mỗi dòng mang mã SHA-256 của chính nó, tính cả mã dòng trước,
// nên sửa hay xoá một dòng là chuỗi gãy. CSDL còn có trigger chặn sửa, xoá (migration consent_records).

/** Mã dòng trước của dòng đầu tiên. */
export const CONSENT_GENESIS_HASH = '0'.repeat(64);
// Khoá tư vấn của PostgreSQL để hai lần ghi cùng lúc không cùng nối vào một dòng trước.
const LEDGER_LOCK_ID = 726201;

export type ConsentEntry = {
  userId: string;
  employeeCode: string;
  fullName: string;
  kind: string;
  version: string;
  action: ConsentAction;
  channel: ConsentChannel;
  ip: string | null;
  userAgent: string | null;
  deviceName: string | null;
  devicePlatform: string | null;
  contentText: string;
  recordedAt: Date;
  migrated?: boolean;
};

export function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/** Chuỗi chuẩn để băm: thứ tự trường cố định, đổi cách tính là mọi mã cũ không khớp nữa. */
function canonical(
  entry: Omit<ConsentEntry, 'contentText' | 'migrated'>,
  contentHash: string,
  prevHash: string,
): string {
  return JSON.stringify([
    'seedgw-consent-v1',
    prevHash,
    entry.userId,
    entry.employeeCode,
    entry.fullName,
    entry.kind,
    entry.version,
    entry.action,
    entry.channel,
    entry.ip,
    entry.userAgent,
    entry.deviceName,
    entry.devicePlatform,
    contentHash,
    entry.recordedAt.toISOString(),
  ]);
}

/** Ghi thêm một dòng vào sổ, trong giao dịch của người gọi. */
export async function appendConsentRecord(
  tx: Prisma.TransactionClient,
  entry: ConsentEntry,
): Promise<{ id: string; recordHash: string }> {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(${LEDGER_LOCK_ID})::text`;
  const last = await tx.consentRecord.findFirst({
    orderBy: { seq: 'desc' },
    select: { recordHash: true },
  });
  const prevHash = last?.recordHash ?? CONSENT_GENESIS_HASH;
  const contentHash = sha256(entry.contentText);
  const recordHash = sha256(canonical(entry, contentHash, prevHash));
  return tx.consentRecord.create({
    data: {
      userId: entry.userId,
      employeeCode: entry.employeeCode,
      fullName: entry.fullName,
      kind: entry.kind,
      version: entry.version,
      action: entry.action,
      channel: entry.channel,
      ip: entry.ip,
      userAgent: entry.userAgent,
      deviceName: entry.deviceName,
      devicePlatform: entry.devicePlatform,
      contentText: entry.contentText,
      contentHash,
      prevHash,
      recordHash,
      recordedAt: entry.recordedAt,
      migrated: entry.migrated ?? false,
    },
    select: { id: true, recordHash: true },
  });
}

type StoredRecord = Prisma.ConsentRecordGetPayload<object>;

/** Tính lại mã từ dữ liệu đã lưu và đối chiếu với dòng trước, dòng sau trong chuỗi. */
export async function checkConsentRecord(record: StoredRecord): Promise<{
  contentMatches: boolean;
  recordMatches: boolean;
  chainMatches: boolean;
}> {
  const contentMatches = sha256(record.contentText) === record.contentHash;
  const recordMatches =
    sha256(canonical(record, record.contentHash, record.prevHash)) === record.recordHash;
  const [previous, next] = await Promise.all([
    db.consentRecord.findFirst({
      where: { seq: { lt: record.seq } },
      orderBy: { seq: 'desc' },
      select: { recordHash: true },
    }),
    db.consentRecord.findFirst({
      where: { seq: { gt: record.seq } },
      orderBy: { seq: 'asc' },
      select: { prevHash: true },
    }),
  ]);
  const chainMatches =
    (previous?.recordHash ?? CONSENT_GENESIS_HASH) === record.prevHash &&
    (next === null || next.prevHash === record.recordHash);
  return { contentMatches, recordMatches, chainMatches };
}

/**
 * Chuyển lời đồng ý đã có ở user_consents sang sổ, một lần: chỉ người chưa có dòng nào cho loại và phiên
 * bản đó. Giờ, kênh, IP lấy từ dữ liệu cũ; nội dung theo phiên bản đã đồng ý. Trả số dòng đã ghi.
 */
export async function backfillConsentLedger(): Promise<number> {
  const rows = await db.userConsent.findMany({
    orderBy: { acceptedAt: 'asc' },
    select: {
      userId: true,
      kind: true,
      version: true,
      channel: true,
      ip: true,
      acceptedAt: true,
      withdrawnAt: true,
      user: { select: { employeeCode: true, fullName: true } },
    },
  });
  let written = 0;
  for (const row of rows) {
    const contentText = renderConsentText(row.kind, row.version);
    if (!contentText) continue;
    const exists = await db.consentRecord.count({
      where: { userId: row.userId, kind: row.kind, version: row.version },
    });
    if (exists > 0) continue;
    const base = {
      userId: row.userId,
      employeeCode: row.user.employeeCode,
      fullName: row.user.fullName,
      kind: row.kind,
      version: row.version,
      channel: row.channel,
      ip: row.ip,
      userAgent: null,
      deviceName: null,
      devicePlatform: null,
      contentText,
      migrated: true,
    };
    await db.$transaction(async (tx) => {
      await appendConsentRecord(tx, { ...base, action: 'ACCEPT', recordedAt: row.acceptedAt });
      if (row.withdrawnAt) {
        await appendConsentRecord(tx, { ...base, action: 'WITHDRAW', recordedAt: row.withdrawnAt });
      }
    });
    written += row.withdrawnAt ? 2 : 1;
  }
  return written;
}
