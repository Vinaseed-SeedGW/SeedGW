import 'server-only';
import NextAuth, { CredentialsSignin } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { loginInput } from '@seedgw/contracts/auth';
import { checkCredentials } from '@/server/services/credentials';
import { isIpBlocked, recordIpFailure } from '@/server/services/login-rate-limit';
import { authConfig } from './auth.config';

export const LOGIN_LOCKED_CODE = 'login_locked';

class LoginLockedError extends CredentialsSignin {
  override code = LOGIN_LOCKED_CODE;
}

export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { employeeCode: {}, password: {} },
      async authorize(raw, request) {
        const parsed = loginInput.safeParse(raw);
        if (!parsed.success) return null;

        // D6: một máy sai quá nhiều lần với nhiều mã nhân viên thì tạm chặn theo IP.
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
        if (await isIpBlocked(ip)) throw new LoginLockedError();
        const result = await checkCredentials(parsed.data.employeeCode, parsed.data.password);
        if (result.status === 'locked') throw new LoginLockedError();
        if (result.status === 'invalid') await recordIpFailure(ip);
        return result.status === 'ok' ? result.user : null;
      },
    }),
  ],
});
