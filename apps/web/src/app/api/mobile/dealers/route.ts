import { NextResponse } from 'next/server';
import { mobileDealersQuery } from '@dms/contracts/dealers';
import { assertMobileCan, mobileError, mobileRoute, requireMobileUser } from '@/server/auth/mobile';
import { listMobileDealers } from '@/server/services/mobile-dealers';

// Đại lý để chọn khi check-in (A7), chỉ trong phạm vi của nhân viên, đại lý gần nhất lên đầu.
export const GET = mobileRoute(async (request: Request) => {
  const user = await requireMobileUser(request);
  assertMobileCan(user, 'sales.check-in.create');
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = mobileDealersQuery.safeParse(params);
  if (!parsed.success) return mobileError('VALIDATION', 'Tham số tìm đại lý không hợp lệ');
  return NextResponse.json({ items: await listMobileDealers(user, parsed.data) });
});
