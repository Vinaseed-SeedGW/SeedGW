import { z } from 'zod';

export const loginInput = z.object({
  employeeCode: z.string().trim().min(1, 'Vui lòng nhập mã nhân viên'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
});
export type LoginInput = z.infer<typeof loginInput>;

export const DEFAULT_LANDING_PATH = '/hub';

function toSameHostPath(target: string, host: string | undefined): string | null {
  if (!/^https?:\/\//i.test(target)) return target;
  if (!host) return null;
  try {
    const url = new URL(target);
    return url.host === host ? `${url.pathname}${url.search}` : null;
  } catch {
    return null;
  }
}

// Chi cho phep quay lai trang noi bo de tranh chuyen huong sang trang ngoai.
// Auth.js truyen callbackUrl dang URL day du nen can doi cung host ve duong dan.
export function safeLandingPath(target: string | null | undefined, host?: string): string {
  const path = target ? toSameHostPath(target, host) : null;
  if (!path || !path.startsWith('/') || path.startsWith('//') || path.includes('\\')) {
    return DEFAULT_LANDING_PATH;
  }
  return path;
}
