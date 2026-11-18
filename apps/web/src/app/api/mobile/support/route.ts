import { after, NextResponse } from 'next/server';
import { createSupportRequestInput, listMySupportInput } from '@dms/contracts/support';
import {
  assertMobileCan,
  mobileError,
  mobileRoute,
  mobileScopedDb,
  requireMobileUser,
} from '@/server/auth/mobile';
import { clientIp, readJson } from '@/server/auth/mobile-request';
import { auditMobileSupport } from '@/server/services/mobile-support';
import { createSupportRequest, listMySupport } from '@/server/services/support';

const NO_PERMISSION = 'Tài khoản chưa được cấp quyền gửi yêu cầu hỗ trợ';

// Yêu cầu của tôi trên app (T3).
export const GET = mobileRoute(async (request: Request) => {
  const user = await requireMobileUser(request);
  assertMobileCan(user, 'support.request.create', NO_PERMISSION);
  const page = Number(new URL(request.url).searchParams.get('trang') ?? '1');
  const input = listMySupportInput.safeParse({
    page: Number.isFinite(page) && page > 0 ? page : 1,
  });
  if (!input.success) return mobileError('VALIDATION', 'Trang không hợp lệ');
  return NextResponse.json(await listMySupport(user, await mobileScopedDb(user), input.data));
});

// Tạo yêu cầu. App soạn lúc mất mạng rồi gửi sau: cùng clientId thì trả lại yêu cầu cũ, không tạo trùng.
export const POST = mobileRoute(async (request: Request) => {
  const user = await requireMobileUser(request);
  assertMobileCan(user, 'support.request.create', NO_PERMISSION);
  const input = await readJson(request, createSupportRequestInput);
  const outcome = await createSupportRequest(user, input);
  const ip = clientIp(request);
  after(() => auditMobileSupport(user, 'support.create', outcome, ip));
  return NextResponse.json({ code: outcome.code, created: outcome.created });
});
