import { after, NextResponse } from 'next/server';
import { isSupportCode } from '@dms/contracts/support';
import { mobileError, mobileRoute, mobileScopedDb, requireMobileUser } from '@/server/auth/mobile';
import { clientIp } from '@/server/auth/mobile-request';
import { auditMobileSupport } from '@/server/services/mobile-support';
import { reopenSupport } from '@/server/services/support';

type Context = { params: Promise<{ code: string }> };

// Người gửi mở lại yêu cầu trong 7 ngày sau Đã xong.
export const POST = mobileRoute(async (request: Request, { params }: Context) => {
  const user = await requireMobileUser(request);
  const { code } = await params;
  if (!isSupportCode(code)) return mobileError('VALIDATION', 'Mã yêu cầu không hợp lệ');
  const outcome = await reopenSupport(user, await mobileScopedDb(user), code);
  const ip = clientIp(request);
  after(() => auditMobileSupport(user, 'support.reopen', outcome, ip));
  return NextResponse.json({ code: outcome.code });
});
