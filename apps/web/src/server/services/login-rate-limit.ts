import 'server-only';
import { Redis } from 'ioredis';
import { LOGIN_FAILURE_WINDOW_MINUTES } from '@seedgw/contracts/auth';

// D6: giới hạn đăng nhập sai theo địa chỉ IP, chống dò nhiều mã nhân viên từ một máy. Khoá theo từng tài
// khoản đã có ở credentials.ts. Không có Redis (máy dev) thì bỏ qua, không chặn đăng nhập.
export const IP_MAX_FAILURES = 30;
const WINDOW_SECONDS = LOGIN_FAILURE_WINDOW_MINUTES * 60;

const REDIS_URL = process.env.REDIS_URL?.trim();
let client: Redis | null = null;

function redis(): Redis | null {
  if (!REDIS_URL) return null;
  if (!client) {
    client = new Redis(REDIS_URL, { maxRetriesPerRequest: 1, enableOfflineQueue: false });
    client.on('error', (error: Error) =>
      console.error('Redis giới hạn đăng nhập lỗi', error.message),
    );
  }
  return client;
}

function key(ip: string): string {
  return `login-fail:${ip}`;
}

/** IP đã sai quá số lần cho phép trong cửa sổ thời gian. Lỗi Redis thì coi như chưa chặn. */
export async function isIpBlocked(ip: string | null): Promise<boolean> {
  const store = redis();
  if (!ip || !store) return false;
  try {
    const count = Number((await store.get(key(ip))) ?? 0);
    return count >= IP_MAX_FAILURES;
  } catch {
    return false;
  }
}

export async function recordIpFailure(ip: string | null): Promise<void> {
  const store = redis();
  if (!ip || !store) return;
  try {
    const count = await store.incr(key(ip));
    if (count === 1) await store.expire(key(ip), WINDOW_SECONDS);
  } catch {
    // Không ghi được thì thôi, khoá theo tài khoản vẫn còn.
  }
}
