import 'server-only';
import { randomInt } from 'node:crypto';
import { hash, verify } from 'argon2';
import {
  LOGIN_FAILURE_WINDOW_MINUTES,
  LOGIN_LOCK_MINUTES,
  LOGIN_MAX_FAILURES,
  passwordPolicy,
} from '@seedgw/contracts/auth';
import { db } from '@seedgw/db/client';

// Bo cac ky tu de nham khi doc qua dien thoai: 0, O, 1, l, I.
const TEMPORARY_PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
const TEMPORARY_PASSWORD_LENGTH = 12;

export function generateTemporaryPassword(): string {
  for (;;) {
    let password = '';
    for (let index = 0; index < TEMPORARY_PASSWORD_LENGTH; index += 1) {
      password += TEMPORARY_PASSWORD_ALPHABET[randomInt(TEMPORARY_PASSWORD_ALPHABET.length)];
    }
    if (passwordPolicy.safeParse(password).success) return password;
  }
}

export function hashPassword(password: string): Promise<string> {
  return hash(password);
}

export const CLEAR_LOGIN_FAILURES = {
  failedLoginCount: 0,
  failedLoginStartedAt: null,
  loginLockedUntil: null,
};

// Mot cau lenh duy nhat de nhieu lan sai dong thoi van duoc dem du.
async function recordFailedLogin(userId: string): Promise<boolean> {
  const rows = await db.$queryRaw<Array<{ login_locked_until: Date | null }>>`
    WITH current_state AS (
      SELECT
        id,
        CASE
          WHEN failed_login_started_at IS NULL
            OR failed_login_started_at < now() - ${LOGIN_FAILURE_WINDOW_MINUTES} * interval '1 minute'
          THEN 1
          ELSE failed_login_count + 1
        END AS next_count,
        CASE
          WHEN failed_login_started_at IS NULL
            OR failed_login_started_at < now() - ${LOGIN_FAILURE_WINDOW_MINUTES} * interval '1 minute'
          THEN now()
          ELSE failed_login_started_at
        END AS next_started_at
      FROM users
      WHERE id = ${userId}::uuid
      FOR UPDATE
    )
    UPDATE users AS u
    SET
      failed_login_count = CASE WHEN s.next_count >= ${LOGIN_MAX_FAILURES} THEN 0 ELSE s.next_count END,
      failed_login_started_at = CASE WHEN s.next_count >= ${LOGIN_MAX_FAILURES} THEN NULL ELSE s.next_started_at END,
      login_locked_until = CASE
        WHEN s.next_count >= ${LOGIN_MAX_FAILURES} THEN now() + ${LOGIN_LOCK_MINUTES} * interval '1 minute'
        ELSE NULL
      END
    FROM current_state AS s
    WHERE u.id = s.id
    RETURNING u.login_locked_until
  `;
  return Boolean(rows[0]?.login_locked_until);
}

type CredentialCheck =
  | {
      status: 'ok';
      user: { id: string; employeeCode: string; fullName: string; sessionVersion: number };
    }
  | { status: 'invalid' }
  | { status: 'locked' };

// Dung chung cho dang nhap web va dang nhap app.
export async function checkCredentials(
  employeeCode: string,
  password: string,
): Promise<CredentialCheck> {
  const user = await db.user.findUnique({
    where: { employeeCode },
    select: {
      id: true,
      employeeCode: true,
      fullName: true,
      passwordHash: true,
      isActive: true,
      sessionVersion: true,
      failedLoginCount: true,
      loginLockedUntil: true,
    },
  });
  if (!user || !user.isActive) return { status: 'invalid' };
  // Dang bi khoa thi khong kiem tra mat khau, ke do khong the thu tiep.
  if (user.loginLockedUntil && user.loginLockedUntil > new Date()) return { status: 'locked' };

  if (!(await verify(user.passwordHash, password))) {
    return (await recordFailedLogin(user.id)) ? { status: 'locked' } : { status: 'invalid' };
  }

  if (user.failedLoginCount > 0 || user.loginLockedUntil) {
    await db.user.update({ where: { id: user.id }, data: CLEAR_LOGIN_FAILURES });
  }
  return {
    status: 'ok',
    user: {
      id: user.id,
      employeeCode: user.employeeCode,
      fullName: user.fullName,
      sessionVersion: user.sessionVersion,
    },
  };
}
