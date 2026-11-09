import 'server-only';
import NextAuth, { CredentialsSignin } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { loginInput } from '@dms/contracts/auth';
import { checkCredentials } from '@/server/services/credentials';
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
      async authorize(raw) {
        const parsed = loginInput.safeParse(raw);
        if (!parsed.success) return null;

        const result = await checkCredentials(parsed.data.employeeCode, parsed.data.password);
        if (result.status === 'locked') throw new LoginLockedError();
        return result.status === 'ok' ? result.user : null;
      },
    }),
  ],
});
