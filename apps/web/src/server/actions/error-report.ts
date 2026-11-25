'use server';

import { z } from 'zod';
import { recordError } from '@seedgw/db/error-log';
import { getCurrentUser } from '@/server/auth/current-user';

const clientErrorInput = z.object({
  message: z.string().trim().min(1).max(1000),
  digest: z.string().trim().max(100).nullable(),
  path: z.string().trim().max(300),
});

/**
 * F9: trang lỗi trên trình duyệt báo về máy chủ. Chỉ ghi khi đã đăng nhập để người ngoài không đổ rác vào
 * bảng lỗi; không trả lỗi về giao diện.
 */
export async function reportClientErrorAction(raw: unknown): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const parsed = clientErrorInput.safeParse(raw);
  if (!parsed.success) return;
  await recordError({
    source: 'WEB_CLIENT',
    message: parsed.data.message,
    path: parsed.data.path,
    userId: user.id,
    context: { digest: parsed.data.digest },
  });
}
