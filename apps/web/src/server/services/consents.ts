import 'server-only';
import {
  LOCATION_CONSENT_KIND,
  LOCATION_CONSENT_VERSION,
  type ConsentChannel,
  type MobileConsentStatus,
} from '@seedgw/contracts/consents';
import { db } from '@seedgw/db/client';

// Lời đồng ý chỉ của chính người dùng, nên đọc ghi theo id người đang đăng nhập, không qua phạm vi dữ liệu.
const CURRENT = { kind: LOCATION_CONSENT_KIND, version: LOCATION_CONSENT_VERSION };

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

/** Trả true khi đây là lần đồng ý mới (để ghi nhật ký), false khi đã đồng ý từ trước. */
export async function acceptLocationConsent(
  userId: string,
  channel: ConsentChannel,
  ip: string | null,
): Promise<boolean> {
  const current = await readLocationConsent(userId);
  if (current.accepted) return false;
  const now = new Date();
  await db.userConsent.upsert({
    where: { userId_kind_version: { userId, ...CURRENT } },
    create: { userId, ...CURRENT, channel, ip, acceptedAt: now },
    update: { channel, ip, acceptedAt: now, withdrawnAt: null },
  });
  return true;
}

/** Trả true khi có lời đồng ý để rút lại. */
export async function withdrawLocationConsent(userId: string): Promise<boolean> {
  const result = await db.userConsent.updateMany({
    where: { userId, ...CURRENT, withdrawnAt: null },
    data: { withdrawnAt: new Date() },
  });
  return result.count > 0;
}
