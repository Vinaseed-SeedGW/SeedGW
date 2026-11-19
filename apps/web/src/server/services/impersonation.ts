import 'server-only';
import { cookies } from 'next/headers';
import { db } from '@seedgw/db/client';
import type { CurrentUser } from '@/server/auth/current-user';
import { IMPERSONATION_COOKIE } from '@/server/auth/impersonation';
import { getScopedDb } from '@/server/auth/scoped-db';
import { DomainError } from '@/server/services/domain-error';
import { allowedActionsFor, USER_ROLES_SELECT } from '@/server/services/users';

const IMPERSONATION_MINUTES = 30;

type StartOutcome = { targetId: string; employeeCode: string };

export async function startImpersonation(
  actor: CurrentUser,
  targetId: string,
): Promise<StartOutcome | null> {
  const scoped = await getScopedDb();
  const target = await scoped.user.findUnique({
    where: { id: targetId },
    select: { id: true, employeeCode: true, isActive: true, roles: USER_ROLES_SELECT },
  });
  if (!target) return null;
  if (!allowedActionsFor(actor, target).impersonate) {
    throw new DomainError('FORBIDDEN', 'Không thể đăng nhập thay tài khoản này');
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + IMPERSONATION_MINUTES * 60_000);
  const session = await db.$transaction(async (tx) => {
    await tx.impersonationSession.updateMany({
      where: { actorId: actor.id, endedAt: null },
      data: { endedAt: now },
    });
    return tx.impersonationSession.create({
      data: { actorId: actor.id, targetId, expiresAt },
      select: { id: true },
    });
  });

  (await cookies()).set(IMPERSONATION_COOKIE, session.id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  });
  return { targetId, employeeCode: target.employeeCode };
}

export async function stopImpersonation(user: CurrentUser): Promise<void> {
  if (!user.impersonator) return;
  await db.impersonationSession.updateMany({
    where: { id: user.impersonator.sessionId, endedAt: null },
    data: { endedAt: new Date() },
  });
  (await cookies()).delete(IMPERSONATION_COOKIE);
}
