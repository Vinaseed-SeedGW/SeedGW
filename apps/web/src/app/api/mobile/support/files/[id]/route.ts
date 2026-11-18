import { NextResponse } from 'next/server';
import { z } from 'zod';
import { mobileError, mobileRoute, mobileScopedDb, requireMobileUser } from '@/server/auth/mobile';
import { readSupportAttachment } from '@/server/services/support';

type Context = { params: Promise<{ id: string }> };

// Tệp đính kèm cho app, đi qua máy chủ web vì kho tệp không mở ra Internet.
export const GET = mobileRoute(async (request: Request, { params }: Context) => {
  const user = await requireMobileUser(request);
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return mobileError('VALIDATION', 'Mã tệp không hợp lệ');
  const file = await readSupportAttachment(user, await mobileScopedDb(user), id.data);
  return new NextResponse(new Uint8Array(file.body), {
    headers: {
      'content-type': file.mimeType,
      'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      'cache-control': 'private, max-age=86400',
    },
  });
});
