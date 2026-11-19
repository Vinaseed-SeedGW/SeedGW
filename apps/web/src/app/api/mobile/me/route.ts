import { FEATURES } from '@dms/contracts/features';
import { NextResponse } from 'next/server';
import { mobileRoute, requireMobileUser } from '@/server/auth/mobile';
import { countPendingForApprover } from '@/server/services/approvals';
import { getMobileProfile } from '@/server/services/mobile-auth';

// App gọi khi mở để biết tài khoản còn dùng được không và lấy giờ máy chủ.
export const GET = mobileRoute(async (request: Request) => {
  const user = await requireMobileUser(request);
  const canReview = user.permissions.has('sales.approval.review');
  const [profile, pendingApprovalCount] = await Promise.all([
    getMobileProfile(user),
    canReview ? countPendingForApprover(user.id) : Promise.resolve(0),
  ]);
  return NextResponse.json({
    user: profile,
    canCheckIn: user.permissions.has('sales.check-in.create'),
    // K3a, A10b (17/11/2026). App cũ bỏ qua các trường này.
    // Chỉ tiêu tạm hold từ 19/11/2026 (features.ts): app không hiện thẻ và màn Chỉ tiêu.
    canRegisterTarget: FEATURES.salesTargets && user.permissions.has('sales.target.register'),
    canRegisterRoute: user.permissions.has('sales.route.register'),
    canReviewApprovals: canReview,
    pendingApprovalCount,
    serverTime: new Date().toISOString(),
  });
});
