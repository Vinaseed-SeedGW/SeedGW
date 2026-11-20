import { NextResponse } from 'next/server';
import { assertMobileCan, mobileRoute, requireMobileUser } from '@/server/auth/mobile';
import { listMyProposals } from '@/server/services/dealer-proposals';

// Đề xuất đại lý mới của chính nhân viên (M10), mục Đại lý tôi đề xuất ở tab Tuyến.
export const GET = mobileRoute(async (request: Request) => {
  const user = await requireMobileUser(request);
  assertMobileCan(user, 'sales.dealer.propose', 'Tài khoản chưa được cấp quyền đề xuất đại lý mới');
  return NextResponse.json(await listMyProposals(user));
});
