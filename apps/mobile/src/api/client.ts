import type { MobileAuthReason, MobileSession } from '@seedgw/contracts/check-ins';
import { noteServerDate } from './server-clock';
import { API_URL, getDeviceIdentity, loadSession, saveSession } from './session';

const TIMEOUT_MS = 20_000;

export type ApiFailure = {
  ok: false;
  status: number;
  code: string;
  message: string;
  reason?: MobileAuthReason;
  /** Mất mạng hoặc máy chủ lỗi: giữ dữ liệu lại để gửi sau. */
  retryable: boolean;
};
export type ApiResult<T> = { ok: true; status: number; data: T } | ApiFailure;

async function rawFetch<T>(
  path: string,
  init: { method: string; body?: BodyInit; json?: unknown; token?: string; contentType?: string },
): Promise<ApiResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const sentAt = Date.now();
  try {
    const response = await fetch(`${API_URL}${path}`, {
      method: init.method,
      signal: controller.signal,
      headers: {
        ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
        ...(init.json !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(init.contentType ? { 'content-type': init.contentType } : {}),
        // Máy chủ so giờ máy với giờ máy chủ để gắn cờ lệch giờ, không chặn.
        'x-device-time': new Date().toISOString(),
      },
      body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
    });
    noteServerDate(response.headers.get('date'), sentAt, Date.now());
    const body = (await response.json().catch(() => ({}))) as {
      code?: string;
      message?: string;
      details?: { reason?: MobileAuthReason };
    };
    if (response.ok) return { ok: true, status: response.status, data: body as T };
    return {
      ok: false,
      status: response.status,
      code: body.code ?? 'INTERNAL',
      message: body.message ?? 'Máy chủ trả lỗi',
      reason: body.details?.reason,
      retryable: response.status >= 500 || response.status === 429,
    };
  } catch {
    return {
      ok: false,
      status: 0,
      code: 'NETWORK',
      message: 'Không kết nối được máy chủ, dữ liệu vẫn lưu trên máy',
      retryable: true,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function login(employeeCode: string, password: string) {
  const device = await getDeviceIdentity();
  const result = await rawFetch<MobileSession>('/api/mobile/auth/login', {
    method: 'POST',
    json: { employeeCode, password, device },
  });
  if (result.ok) await saveSession(result.data);
  return result;
}

let refreshing: Promise<MobileSession | null> | null = null;

async function refresh(session: MobileSession): Promise<MobileSession | null> {
  refreshing ??= (async () => {
    const result = await rawFetch<MobileSession>('/api/mobile/auth/refresh', {
      method: 'POST',
      json: { refreshToken: session.refreshToken },
    });
    if (result.ok) {
      await saveSession(result.data);
      return result.data;
    }
    // Chỉ đăng xuất khi máy chủ từ chối rõ ràng, mất mạng thì giữ phiên để thử lại.
    if (!result.retryable) await saveSession(null);
    return null;
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

/** Khoá truy cập còn hạn, dùng khi tải ảnh qua thẻ Image (không đi qua apiCall). */
export async function freshAccessToken(): Promise<string | null> {
  const session = await loadSession();
  if (!session) return null;
  if (Date.parse(session.accessExpiresAt) - Date.now() < 30_000) {
    return (await refresh(session))?.accessToken ?? null;
  }
  return session.accessToken;
}

/** Gọi API có đăng nhập. Khoá truy cập hết hạn thì tự làm mới một lần rồi gọi lại. */
export async function apiCall<T>(
  path: string,
  init: { method: string; body?: BodyInit; json?: unknown; contentType?: string },
): Promise<ApiResult<T>> {
  let session = await loadSession();
  if (!session) {
    return {
      ok: false,
      status: 401,
      code: 'UNAUTHENTICATED',
      message: 'Chưa đăng nhập',
      retryable: false,
    };
  }
  if (Date.parse(session.accessExpiresAt) - Date.now() < 30_000) {
    session = (await refresh(session)) ?? session;
  }
  let result = await rawFetch<T>(path, { ...init, token: session.accessToken });
  if (!result.ok && result.status === 401 && result.reason === 'SESSION_EXPIRED') {
    const renewed = await refresh(session);
    if (renewed) result = await rawFetch<T>(path, { ...init, token: renewed.accessToken });
  }
  if (!result.ok && result.reason === 'DEVICE_REVOKED') await saveSession(null);
  return result;
}

export async function logout(): Promise<void> {
  const session = await loadSession();
  if (session) {
    await rawFetch('/api/mobile/auth/logout', {
      method: 'POST',
      json: { refreshToken: session.refreshToken },
    });
  }
  await saveSession(null);
}
