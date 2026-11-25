import type { ErrorSource, Prisma } from '@prisma/client';
import { db } from './client';

// F9: ghi lỗi vào CSDL thay cho dịch vụ ngoài. Không bao giờ ném lỗi ra ngoài, không làm hỏng việc đang làm.
// Không ghi nội dung yêu cầu, mật khẩu, token: chỉ nội dung lỗi, ngăn xếp, đường dẫn và vài thông tin máy.

const MESSAGE_LIMIT = 1_000;
const STACK_LIMIT = 8_000;
const PATH_LIMIT = 300;
export const ERROR_RETENTION_DAYS = 90;
// Che chuỗi giống token, khoá, mật khẩu nếu lỡ nằm trong nội dung lỗi.
const SECRET_PATTERN =
  /(bearer\s+)[a-z0-9._-]+|((?:password|token|apikey|api_key|secret)[=:]\s*)[^\s&]+/gi;

export type ErrorReport = {
  source: ErrorSource;
  error?: unknown;
  message?: string;
  stack?: string | null;
  path?: string | null;
  appVersion?: string | null;
  userId?: string | null;
  context?: Record<string, string | number | boolean | null>;
};

function clean(text: string, limit: number): string {
  return text.replace(SECRET_PATTERN, '$1$2***').slice(0, limit);
}

function describe(report: ErrorReport): { message: string; stack: string | null } {
  if (report.error instanceof Error) {
    return {
      message: report.error.message || report.error.name,
      stack: report.error.stack ?? null,
    };
  }
  if (report.message) return { message: report.message, stack: report.stack ?? null };
  return { message: String(report.error ?? 'Lỗi không rõ'), stack: report.stack ?? null };
}

/** Băm FNV-1a 2 lần 32 bit, viết thuần JS để tệp này không kéo thư viện của Node vào bản dựng trình duyệt. */
function fingerprintOf(text: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ text.length;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    a = Math.imul(a ^ code, 0x01000193) >>> 0;
    b = Math.imul(b ^ code, 0x5bd1e995) >>> 0;
  }
  return `${a.toString(16).padStart(8, '0')}${b.toString(16).padStart(8, '0')}${text.length.toString(16)}`;
}

/** Dòng đầu ngăn xếp có tên tệp, bỏ số cột để bản build khác nhau vẫn gộp đúng. */
function topFrame(stack: string | null): string {
  const frame = stack?.split('\n').find((line) => line.trim().startsWith('at ')) ?? '';
  return frame.replace(/:\d+(:\d+)?\)?$/, '').trim();
}

export async function recordError(report: ErrorReport): Promise<void> {
  try {
    const { message: rawMessage, stack: rawStack } = describe(report);
    const message = clean(rawMessage, MESSAGE_LIMIT);
    const stack = rawStack ? clean(rawStack, STACK_LIMIT) : null;
    // Gộp theo nguồn, nội dung bỏ số (mã, id thay đổi), dòng đầu ngăn xếp.
    const fingerprint = fingerprintOf(
      `${report.source}|${message.replace(/\d+/g, '#')}|${topFrame(stack)}`,
    );
    const now = new Date();
    const data = {
      message,
      stack,
      path: report.path ? report.path.slice(0, PATH_LIMIT) : null,
      appVersion: report.appVersion?.slice(0, 50) ?? null,
      userId: report.userId ?? null,
      context: (report.context ?? {}) as Prisma.InputJsonValue,
      lastSeenAt: now,
    };
    await db.errorLog.upsert({
      where: { fingerprint },
      create: { fingerprint, source: report.source, ...data },
      // Lỗi đã đánh dấu xử lý mà gặp lại thì mở lại.
      update: { ...data, count: { increment: 1 }, resolvedAt: null },
    });
  } catch (failure) {
    console.error('Không ghi được lỗi vào CSDL', failure);
  }
}

export async function purgeOldErrors(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - ERROR_RETENTION_DAYS * 86_400_000);
  const { count } = await db.errorLog.deleteMany({ where: { lastSeenAt: { lt: cutoff } } });
  return count;
}
