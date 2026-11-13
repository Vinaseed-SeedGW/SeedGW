import 'server-only';
import type { z } from 'zod';
import { DomainError } from '@/server/services/domain-error';

// Đọc và kiểm JSON gửi lên từ app. Sai thì ném lỗi để mobileRoute trả 400 tiếng Việt.
export async function readJson<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<z.infer<T>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new DomainError('VALIDATION', 'Dữ liệu gửi lên không phải JSON');
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new DomainError('VALIDATION', first?.message ?? 'Dữ liệu gửi lên không hợp lệ');
  }
  return parsed.data;
}

export function clientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || request.headers.get('x-real-ip');
}
