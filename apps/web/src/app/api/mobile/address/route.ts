import { NextResponse } from 'next/server';
import { addressQuery } from '@dms/contracts/check-ins';
import { mobileError, mobileRoute, requireMobileUser } from '@/server/auth/mobile';
import { reverseGeocode } from '@/server/integrations/vietmap';

// Địa chỉ cho dải thông tin trên máy ảnh (V3). Khoá Vietmap chỉ nằm trên máy chủ.
export const GET = mobileRoute(async (request: Request) => {
  await requireMobileUser(request);
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = addressQuery.safeParse(params);
  if (!parsed.success) return mobileError('VALIDATION', 'Toạ độ không hợp lệ');
  const outcome = await reverseGeocode(parsed.data.lat, parsed.data.lng);
  return NextResponse.json({ address: outcome.ok ? outcome.address : null });
});
