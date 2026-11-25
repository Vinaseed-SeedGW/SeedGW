import { NextResponse } from 'next/server';
import { mobileRoute, requireMobileUser } from '@/server/auth/mobile';
import { listOwnConsentRecords } from '@/server/services/consents';

// 25/11/2026: sổ đồng ý của chính người dùng, để xem và chia sẻ giấy xác nhận trên app.
export const GET = mobileRoute(async (request: Request) => {
  const user = await requireMobileUser(request);
  return NextResponse.json({ items: await listOwnConsentRecords(user.id) });
});
