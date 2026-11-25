import { NextResponse } from 'next/server';
import { mobileCustomersQuery, type MobileCustomersResult } from '@seedgw/contracts/customers';
import { assertMobileCan, mobileError, mobileRoute, requireMobileUser } from '@/server/auth/mobile';
import { listMobileCustomers } from '@/server/services/mobile-customers';

// S1: khách hàng để chọn khi check-in loại Khách hàng, trong phạm vi của nhân viên, gần nhất lên đầu.
export const GET = mobileRoute(async (request: Request) => {
  const user = await requireMobileUser(request);
  assertMobileCan(user, 'sales.check-in.create');
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = mobileCustomersQuery.safeParse(params);
  if (!parsed.success) return mobileError('VALIDATION', 'Tham số tìm khách hàng không hợp lệ');
  const body: MobileCustomersResult = { items: await listMobileCustomers(user, parsed.data) };
  return NextResponse.json(body);
});
