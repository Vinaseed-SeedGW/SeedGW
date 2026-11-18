import { NextResponse } from 'next/server';
import { isSupportCode } from '@dms/contracts/support';
import { mobileError, mobileRoute, mobileScopedDb, requireMobileUser } from '@/server/auth/mobile';
import { markSupportRead, readSupportDetail } from '@/server/services/support';

type Context = { params: Promise<{ code: string }> };

// Chi tiết một yêu cầu trên app; mở xem là đã đọc. Tệp tải qua /api/mobile/support/files/[id].
export const GET = mobileRoute(async (request: Request, { params }: Context) => {
  const user = await requireMobileUser(request);
  const { code } = await params;
  if (!isSupportCode(code)) return mobileError('VALIDATION', 'Mã yêu cầu không hợp lệ');
  const scoped = await mobileScopedDb(user);
  const detail = await readSupportDetail(user, scoped, code, 'mobile');
  await markSupportRead(user, scoped, code);
  return NextResponse.json({ ...detail, unread: false });
});
