import { NextResponse } from 'next/server';
import { registerPushTokenInput, unregisterPushTokenInput } from '@dms/contracts/push';
import { mobileRoute, requireMobileUser } from '@/server/auth/mobile';
import { readJson } from '@/server/auth/mobile-request';
import { registerPushToken, unregisterPushToken } from '@/server/services/push-tokens';

// App gửi mã nhận thông báo của máy khi đăng nhập và mỗi lần mở app (M7).
export const POST = mobileRoute(async (request: Request) => {
  const user = await requireMobileUser(request);
  await registerPushToken(user, await readJson(request, registerPushTokenInput));
  return NextResponse.json({ ok: true });
});

export const DELETE = mobileRoute(async (request: Request) => {
  const user = await requireMobileUser(request);
  const input = await readJson(request, unregisterPushTokenInput);
  await unregisterPushToken(user, input.token);
  return NextResponse.json({ ok: true });
});
