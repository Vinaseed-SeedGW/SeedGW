import { NextResponse } from 'next/server';
import { mobileRefreshInput } from '@dms/contracts/check-ins';
import { mobileRoute } from '@/server/auth/mobile';
import { readJson } from '@/server/auth/mobile-request';
import { refreshMobile } from '@/server/services/mobile-auth';

export const POST = mobileRoute(async (request: Request) => {
  const { refreshToken } = await readJson(request, mobileRefreshInput);
  return NextResponse.json(await refreshMobile(refreshToken));
});
