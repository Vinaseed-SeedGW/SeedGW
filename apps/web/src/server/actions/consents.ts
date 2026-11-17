'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { auditChanges } from '@dms/contracts/audit';
import { CONSENT_LATER_COOKIE, LOCATION_CONSENT_VERSION } from '@dms/contracts/consents';
import { getCurrentUser } from '@/server/auth/current-user';
import { getClientIp, writeAudit } from '@/server/services/audit';
import { acceptLocationConsent } from '@/server/services/consents';

// Không dùng requireUser vì hàm đó chuyển người chưa đồng ý về chính trang hỏi đồng ý.
async function signedInUser() {
  const user = await getCurrentUser();
  if (!user) redirect('/api/session/expired');
  return user;
}

export async function acceptLocationConsentAction(): Promise<void> {
  const user = await signedInUser();
  if (!user.impersonator) {
    const ip = await getClientIp();
    const isNew = await acceptLocationConsent(user.id, 'WEB', ip);
    if (isNew) {
      after(() =>
        writeAudit({
          actor: user,
          action: 'consent.accept',
          entityType: 'User',
          entityId: user.id,
          entityLabel: `${user.employeeCode} ${user.fullName}`,
          changes: auditChanges(
            {},
            { 'Đồng ý chia sẻ vị trí': `Bản ${LOCATION_CONSENT_VERSION}, trên web` },
          ),
          ip,
        }),
      );
    }
  }
  redirect('/hub');
}

/** Không đồng ý vẫn dùng web được (web không lấy vị trí); trong phiên này không hỏi lại. */
export async function declineLocationConsentAction(): Promise<void> {
  await signedInUser();
  (await cookies()).set(CONSENT_LATER_COOKIE, '1', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
  });
  redirect('/hub');
}
