import { NextResponse } from 'next/server';
import { mobileRoute, requireMobileUser } from '@/server/auth/mobile';
import { getMobileProfile } from '@/server/services/mobile-auth';

// App gọi khi mở để biết tài khoản còn dùng được không và lấy giờ máy chủ.
export const GET = mobileRoute(async (request: Request) => {
  const user = await requireMobileUser(request);
  return NextResponse.json({
    user: await getMobileProfile(user),
    canCheckIn: user.permissions.has('sales.check-in.create'),
    serverTime: new Date().toISOString(),
  });
});
