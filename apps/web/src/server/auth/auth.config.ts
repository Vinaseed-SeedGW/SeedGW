import type { NextAuthConfig } from 'next-auth';
import { DEFAULT_LANDING_PATH } from '@dms/contracts/auth';

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

// File nay chay o middleware nen khong duoc import database hoac argon2.
export const authConfig = {
  trustHost: true,
  session: { strategy: 'jwt', maxAge: SESSION_MAX_AGE_SECONDS },
  pages: { signIn: '/login' },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = Boolean(auth?.user);
      if (request.nextUrl.pathname === '/login') {
        return isLoggedIn
          ? Response.redirect(new URL(DEFAULT_LANDING_PATH, request.nextUrl))
          : true;
      }
      return isLoggedIn;
    },
    jwt({ token, user }) {
      if (user?.id) {
        token.userId = user.id;
        token.employeeCode = user.employeeCode;
        token.fullName = user.fullName;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.userId;
      session.user.employeeCode = token.employeeCode;
      session.user.fullName = token.fullName;
      return session;
    },
  },
} satisfies NextAuthConfig;
