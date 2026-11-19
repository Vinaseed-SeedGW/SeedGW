import { NextResponse } from 'next/server';
import { mobileRefreshInput } from '@seedgw/contracts/check-ins';
import { mobileRoute } from '@/server/auth/mobile';
import { readJson } from '@/server/auth/mobile-request';
import { logoutMobile } from '@/server/services/mobile-auth';

export const POST = mobileRoute(async (request: Request) => {
  const { refreshToken } = await readJson(request, mobileRefreshInput);
  await logoutMobile(refreshToken);
  return NextResponse.json({ ok: true });
});
