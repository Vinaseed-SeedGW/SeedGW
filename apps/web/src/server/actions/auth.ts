'use server';

import { headers } from 'next/headers';
import { AuthError } from 'next-auth';
import { loginInput } from '@dms/contracts/auth';
import type { ActionResult } from '@dms/contracts/common';
import { safeLandingPath } from '@dms/contracts/landing';
import { signIn, signOut } from '@/server/auth/auth';

export async function loginAction(
  _previous: ActionResult<never> | null,
  formData: FormData,
): Promise<ActionResult<never> | null> {
  const parsed = loginInput.safeParse({
    employeeCode: formData.get('employeeCode'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return {
      ok: false,
      code: 'VALIDATION',
      message: parsed.error.issues[0]?.message ?? 'Thông tin đăng nhập không hợp lệ',
    };
  }

  try {
    const landing = formData.get('callbackUrl');
    const host = (await headers()).get('host') ?? undefined;
    await signIn('credentials', {
      ...parsed.data,
      redirectTo: safeLandingPath(typeof landing === 'string' ? landing : null, host),
    });
    return null;
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        ok: false,
        code: 'UNAUTHENTICATED',
        message: 'Mã nhân viên hoặc mật khẩu không đúng',
      };
    }
    // Next.js dung loi noi bo de chuyen huong sau khi dang nhap thanh cong.
    throw error;
  }
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: '/login' });
}
