import { NextResponse } from 'next/server';
import { assertMobileCan, mobileRoute, requireMobileUser } from '@/server/auth/mobile';
import { listMobileProposalReview } from '@/server/services/dealer-proposals';

// 25/11/2026: Quản lý, Lãnh đạo đơn vị xem đề xuất đại lý mới chờ mình duyệt ở Cần duyệt, tab Tôi.
export const GET = mobileRoute(async (request: Request) => {
  const user = await requireMobileUser(request);
  assertMobileCan(user, 'sales.approval.review', 'Tài khoản chưa được cấp quyền duyệt');
  return NextResponse.json(await listMobileProposalReview(user.id));
});
