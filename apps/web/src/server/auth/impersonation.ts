import 'server-only';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { db } from '@seedgw/db/client';

export const IMPERSONATION_COOKIE = 'seedgw-impersonation';

// Cookie chi tro toi ban ghi tren may chu va gan voi dung nguoi da mo phien nay,
// nen lo cookie cung khong dung duoc neu khong co phien dang nhap cua nguoi do.
export async function findActiveImpersonation(actorId: string, sessionVersion: number) {
  const sessionId = (await cookies()).get(IMPERSONATION_COOKIE)?.value;
  if (!sessionId || !z.uuid().safeParse(sessionId).success) return null;

  return db.impersonationSession.findFirst({
    where: {
      id: sessionId,
      actorId,
      endedAt: null,
      expiresAt: { gt: new Date() },
      target: { isActive: true },
      actor: {
        isActive: true,
        sessionVersion,
        roles: {
          some: { role: { permissions: { some: { code: 'admin.user.impersonate' } } } },
        },
      },
    },
    select: { id: true, targetId: true, actor: { select: { fullName: true } } },
  });
}
