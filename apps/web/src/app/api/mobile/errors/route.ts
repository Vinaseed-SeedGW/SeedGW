import { NextResponse } from 'next/server';
import { z } from 'zod';
import { logError } from '@/server/services/error-log';
import { mobileRoute, requireMobileUser } from '@/server/auth/mobile';
import { readJson } from '@/server/auth/mobile-request';

const mobileErrorInput = z.object({
  message: z.string().trim().min(1).max(1000),
  stack: z.string().max(8000).nullable(),
  screen: z.string().trim().max(100).nullable(),
  appVersion: z.string().trim().max(100).nullable(),
  platform: z.enum(['ios', 'android']).nullable(),
  fatal: z.boolean(),
});

// F9: app báo lỗi JS về máy chủ. Chỉ nhận từ máy đã đăng nhập; lỗi giống nhau gộp một dòng.
export const POST = mobileRoute(async (request: Request) => {
  const user = await requireMobileUser(request);
  const input = await readJson(request, mobileErrorInput);
  await logError({
    source: 'MOBILE',
    message: input.message,
    stack: input.stack,
    path: input.screen,
    appVersion: input.appVersion,
    userId: user.id,
    context: { platform: input.platform, fatal: input.fatal },
  });
  return NextResponse.json({ ok: true });
});
