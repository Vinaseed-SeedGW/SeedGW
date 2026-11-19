import { NextResponse } from 'next/server';
import { mobileLoginInput } from '@seedgw/contracts/check-ins';
import { mobileRoute } from '@/server/auth/mobile';
import { clientIp, readJson } from '@/server/auth/mobile-request';
import { loginMobile } from '@/server/services/mobile-auth';

export const POST = mobileRoute(async (request: Request) => {
  const input = await readJson(request, mobileLoginInput);
  return NextResponse.json(await loginMobile(input, clientIp(request)));
});
