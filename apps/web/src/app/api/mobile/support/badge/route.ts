import { NextResponse } from 'next/server';
import { mobileRoute, mobileScopedDb, requireMobileUser } from '@/server/auth/mobile';
import { countSupportBadge } from '@/server/services/support';

// Số đỏ trên tab Tôi: yêu cầu của tôi có trả lời chưa đọc. App hỏi khi mở app và mỗi 60 giây khi đang mở.
export const GET = mobileRoute(async (request: Request) => {
  const user = await requireMobileUser(request);
  return NextResponse.json({ count: await countSupportBadge(user, await mobileScopedDb(user)) });
});
