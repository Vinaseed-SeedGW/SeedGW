import { NextResponse } from 'next/server';
import {
  markNotificationsReadInput,
  mobileNotificationsQuery,
  NOTIFICATION_PAGE_SIZE,
} from '@seedgw/contracts/notifications';
import { mobileError, mobileRoute, requireMobileUser } from '@/server/auth/mobile';
import { readJson } from '@/server/auth/mobile-request';
import { markRead, readMobileNotifications } from '@/server/services/notifications';

// D4: thông báo của chính người dùng trên app, cùng dữ liệu với trang Thông báo trên web.
export const GET = mobileRoute(async (request: Request) => {
  const user = await requireMobileUser(request);
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = mobileNotificationsQuery.safeParse(params);
  if (!parsed.success) return mobileError('VALIDATION', 'Tham số thông báo không hợp lệ');
  return NextResponse.json(
    await readMobileNotifications(user.id, parsed.data.page, NOTIFICATION_PAGE_SIZE),
  );
});

export const POST = mobileRoute(async (request: Request) => {
  const user = await requireMobileUser(request);
  const input = await readJson(request, markNotificationsReadInput);
  return NextResponse.json({ count: await markRead(user.id, input) });
});
