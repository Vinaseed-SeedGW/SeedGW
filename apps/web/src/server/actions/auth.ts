'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { AuthError, CredentialsSignin } from 'next-auth';
import { changePasswordInput, LOGIN_LOCK_MINUTES, loginInput } from '@seedgw/contracts/auth';
import type { ActionResult } from '@seedgw/contracts/common';
import { safeLandingPath } from '@seedgw/contracts/landing';
import { toActionError, validationError } from '@/server/auth/action-error';
import { LOGIN_LOCKED_CODE, signIn, signOut } from '@/server/auth/auth';
import { getCurrentUser } from '@/server/auth/current-user';
import { getClientIp, writeAudit } from '@/server/services/audit';
import { stopImpersonation } from '@/server/services/impersonation';
import { changeOwnPassword } from '@/server/services/users';

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
    if (error instanceof CredentialsSignin && error.code === LOGIN_LOCKED_CODE) {
      return {
        ok: false,
        code: 'CONFLICT',
        message: `Tài khoản tạm khoá ${LOGIN_LOCK_MINUTES} phút do nhập sai mật khẩu nhiều lần`,
      };
    }
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

export async function changePasswordAction(raw: unknown): Promise<ActionResult<never>> {
  try {
    // Khong dung requireUser vi ham do se chuyen huong nguoi dang phai doi mat khau ve chinh trang nay.
    const user = await getCurrentUser();
    if (!user) redirect('/api/session/expired');
    if (user.impersonator) {
      return {
        ok: false,
        code: 'FORBIDDEN',
        message: 'Không thể đổi mật khẩu khi đang đăng nhập thay',
      };
    }

    const parsed = changePasswordInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);

    const [, ip] = await Promise.all([changeOwnPassword(user, parsed.data), getClientIp()]);
    after(() =>
      writeAudit({
        actor: user,
        action: 'user.change-password',
        entityType: 'User',
        entityId: user.id,
        entityLabel: user.employeeCode,
        changes: {},
        ip,
      }),
    );

    // Doi mat khau da thu hoi moi phien cu, ke ca phien nay, nen cap lai phien moi.
    return await signIn('credentials', {
      employeeCode: user.employeeCode,
      password: parsed.data.newPassword,
      redirectTo: '/hub',
    });
  } catch (error) {
    return toActionError(error);
  }
}

export async function logoutAction(): Promise<void> {
  const user = await getCurrentUser();
  if (user?.impersonator) {
    const ip = await getClientIp();
    await stopImpersonation(user);
    await writeAudit({
      actor: { id: user.impersonator.id, impersonator: null },
      action: 'user.impersonate-stop',
      entityType: 'User',
      entityId: user.id,
      entityLabel: user.employeeCode,
      changes: {},
      ip,
    });
  }
  await signOut({ redirectTo: '/login' });
}
