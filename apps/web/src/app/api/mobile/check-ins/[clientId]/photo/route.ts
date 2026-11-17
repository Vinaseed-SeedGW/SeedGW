import { NextResponse } from 'next/server';
import { z } from 'zod';
import { MAX_PHOTO_BYTES } from '@dms/contracts/check-ins';
import { assertMobileCan, mobileError, mobileRoute, requireMobileUser } from '@/server/auth/mobile';
import { saveCheckInPhoto } from '@/server/services/check-ins';
import { readMyCheckInPhoto } from '@/server/services/mobile-history';

type Context = { params: Promise<{ clientId: string }> };

// Ảnh gửi riêng sau dòng check-in, gửi lại nhiều lần vẫn chỉ giữ một ảnh.
export const PUT = mobileRoute(async (request: Request, { params }: Context) => {
  const user = await requireMobileUser(request);
  assertMobileCan(user, 'sales.check-in.create');
  const clientId = z.uuid().safeParse((await params).clientId);
  if (!clientId.success) return mobileError('VALIDATION', 'Mã check-in không hợp lệ');

  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > MAX_PHOTO_BYTES) return mobileError('VALIDATION', 'Ảnh quá lớn');
  const bytes = Buffer.from(await request.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_PHOTO_BYTES) {
    return mobileError('VALIDATION', 'Ảnh trống hoặc quá lớn');
  }
  await saveCheckInPhoto(user, clientId.data, bytes);
  return NextResponse.json({ ok: true });
});

// Xem lại ảnh của chính mình ở tab Lịch sử (M6). Ảnh giữ 45 ngày.
export const GET = mobileRoute(async (request: Request, { params }: Context) => {
  const user = await requireMobileUser(request);
  const clientId = z.uuid().safeParse((await params).clientId);
  if (!clientId.success) return mobileError('VALIDATION', 'Mã check-in không hợp lệ');
  const bytes = await readMyCheckInPhoto(user, clientId.data);
  return new NextResponse(new Uint8Array(bytes), {
    headers: { 'content-type': 'image/jpeg', 'cache-control': 'private, max-age=86400' },
  });
});
