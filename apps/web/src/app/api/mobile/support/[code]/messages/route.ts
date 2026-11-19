import { NextResponse } from 'next/server';
import { z } from 'zod';
import { mobileError, mobileRoute, mobileScopedDb, requireMobileUser } from '@/server/auth/mobile';
import { readJson } from '@/server/auth/mobile-request';
import { replySupport } from '@/server/services/support';
import { isSupportCode, replySupportInput } from '@seedgw/contracts/support';

type Context = { params: Promise<{ code: string }> };

const body = replySupportInput.omit({ code: true }).extend({
  // App gửi nội dung trước, tệp gửi sau từng tệp; tin chỉ có tệp thì nội dung rỗng.
  hasFiles: z.boolean().default(false),
});

// Trả lời trong yêu cầu. Cùng clientId thì không tạo tin thứ hai.
export const POST = mobileRoute(async (request: Request, { params }: Context) => {
  const user = await requireMobileUser(request);
  const { code } = await params;
  if (!isSupportCode(code)) return mobileError('VALIDATION', 'Mã yêu cầu không hợp lệ');
  const input = await readJson(request, body);
  if (!input.body && !input.hasFiles)
    return mobileError('VALIDATION', 'Nhập nội dung hoặc đính kèm tệp');
  const outcome = await replySupport(
    user,
    await mobileScopedDb(user),
    { code, clientId: input.clientId, body: input.body },
    [],
    new Date(),
    input.hasFiles,
  );
  return NextResponse.json({ code: outcome.code, created: outcome.created });
});
