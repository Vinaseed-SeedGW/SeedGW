import { NextResponse } from 'next/server';
import { mobileRoute, mobileScopedDb, requireMobileUser } from '@/server/auth/mobile';
import { readSupportButtonSummary } from '@/server/services/support';

// Số đỏ trên nút nổi Hỗ trợ của app (quyết định 32): trả lời mới của mình, cộng việc chờ xử lý nếu có quyền.
// App hỏi khi mở app và mỗi 60 giây khi đang mở.
export const GET = mobileRoute(async (request: Request) => {
  const user = await requireMobileUser(request);
  const summary = await readSupportButtonSummary(user, await mobileScopedDb(user));
  return NextResponse.json({ count: summary.unread + summary.pending, ...summary });
});
