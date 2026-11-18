import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isSupportCode } from '@dms/contracts/support';
import { SUPPORT_MAX_FILE_BYTES } from '@dms/contracts/support-files';
import { mobileError, mobileRoute, mobileScopedDb, requireMobileUser } from '@/server/auth/mobile';
import { addSupportAttachment } from '@/server/services/support';

type Context = { params: Promise<{ code: string }> };

const query = z.object({
  tin: z.uuid(),
  tep: z.uuid(),
  ten: z.string().trim().min(1).max(200),
});

// Gửi từng tệp sau tin nhắn (thân là nội dung tệp): ?tin=<clientId tin>&tep=<clientId tệp>&ten=<tên tệp>.
// Gửi lại cùng mã tệp thì không lưu thêm. Máy chủ kiểm loại tệp theo nội dung, chỉ nhận dưới 10 MB.
export const PUT = mobileRoute(async (request: Request, { params }: Context) => {
  const user = await requireMobileUser(request);
  const { code } = await params;
  if (!isSupportCode(code)) return mobileError('VALIDATION', 'Mã yêu cầu không hợp lệ');
  const url = new URL(request.url);
  const parsed = query.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return mobileError('VALIDATION', 'Thông tin tệp không hợp lệ');
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > SUPPORT_MAX_FILE_BYTES) return mobileError('VALIDATION', 'Tệp lớn hơn 10 MB');
  const bytes = new Uint8Array(await request.arrayBuffer());
  const result = await addSupportAttachment(
    user,
    await mobileScopedDb(user),
    code,
    parsed.data.tin,
    parsed.data.tep,
    { name: parsed.data.ten, bytes },
  );
  return NextResponse.json(result);
});
