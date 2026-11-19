import 'server-only';
import type { RegisterPushTokenInput } from '@seedgw/contracts/push';
import { db } from '@seedgw/db/client';
import type { MobileUser } from '@/server/auth/mobile';

// Mã nhận thông báo của máy (M7). Máy đổi người đăng nhập thì mã chuyển sang người mới.
export async function registerPushToken(
  user: MobileUser,
  input: RegisterPushTokenInput,
): Promise<void> {
  const now = new Date();
  await db.pushToken.upsert({
    where: { token: input.token },
    create: {
      token: input.token,
      userId: user.id,
      deviceId: user.deviceId,
      platform: input.platform,
      lastSeenAt: now,
    },
    update: { userId: user.id, deviceId: user.deviceId, platform: input.platform, lastSeenAt: now },
  });
}

/** Đăng xuất thì xoá mã, máy không nhận thông báo của người vừa đăng xuất nữa. */
export async function unregisterPushToken(user: MobileUser, token: string): Promise<void> {
  await db.pushToken.deleteMany({ where: { token, userId: user.id } });
}
