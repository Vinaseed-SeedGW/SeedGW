import 'server-only';
import { verify } from 'argon2';
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { loginInput } from '@dms/contracts/auth';
import { db } from '@dms/db/client';
import { authConfig } from './auth.config';

export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { employeeCode: {}, password: {} },
      async authorize(raw) {
        const parsed = loginInput.safeParse(raw);
        if (!parsed.success) return null;

        const user = await db.user.findUnique({
          where: { employeeCode: parsed.data.employeeCode },
        });
        if (!user || !user.isActive) return null;

        const isValid = await verify(user.passwordHash, parsed.data.password);
        if (!isValid) return null;

        return { id: user.id, employeeCode: user.employeeCode, fullName: user.fullName };
      },
    }),
  ],
});
