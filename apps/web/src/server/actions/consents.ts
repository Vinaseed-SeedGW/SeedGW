'use server';

import { revalidatePath } from 'next/cache';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { auditChanges } from '@seedgw/contracts/audit';
import type { ActionResult } from '@seedgw/contracts/common';
import { CONSENT_LATER_COOKIE, LOCATION_CONSENT_VERSION } from '@seedgw/contracts/consents';
import { toActionError } from '@/server/auth/action-error';
import { getCurrentUser } from '@/server/auth/current-user';
import { getClientIp, writeAudit } from '@/server/services/audit';
import {
  acceptLocationConsent,
  withdrawLocationConsent,
  type ConsentMeta,
} from '@/server/services/consents';

// Không dùng requireUser vì hàm đó chuyển người chưa đồng ý về chính trang hỏi đồng ý.
async function signedInUser() {
  const user = await getCurrentUser();
  if (!user) redirect('/api/session/expired');
  return user;
}

async function webMeta(): Promise<ConsentMeta> {
  const [ip, requestHeaders] = await Promise.all([getClientIp(), headers()]);
  return { channel: 'WEB', ip, userAgent: requestHeaders.get('user-agent'), deviceId: null };
}

type SignedInUser = Awaited<ReturnType<typeof signedInUser>>;

function auditConsent(user: SignedInUser, accepted: boolean, ip: string | null): void {
  after(() =>
    writeAudit({
      actor: user,
      action: accepted ? 'consent.accept' : 'consent.withdraw',
      entityType: 'User',
      entityId: user.id,
      entityLabel: `${user.employeeCode} ${user.fullName}`,
      changes: auditChanges(
        {},
        {
          'Đồng ý chia sẻ vị trí': `${accepted ? 'Đồng ý' : 'Rút lại'}, bản ${LOCATION_CONSENT_VERSION}, trên web`,
        },
      ),
      ip,
    }),
  );
}

export async function acceptLocationConsentAction(): Promise<void> {
  const user = await signedInUser();
  // Đăng nhập thay không được đồng ý thay người khác.
  if (!user.impersonator) {
    const meta = await webMeta();
    if (await acceptLocationConsent(user.id, meta)) auditConsent(user, true, meta.ip);
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

/** Trang Đồng ý của tôi: đồng ý hoặc rút lại ngay trên web. Chỉ chính chủ, không qua đăng nhập thay. */
export async function changeOwnLocationConsentAction(
  accept: boolean,
): Promise<ActionResult<{ accepted: boolean }>> {
  try {
    const user = await signedInUser();
    if (user.impersonator) {
      return {
        ok: false,
        code: 'FORBIDDEN',
        message: 'Đang đăng nhập thay, không đồng ý hay rút lại thay người khác được',
      };
    }
    const meta = await webMeta();
    const changed = accept
      ? await acceptLocationConsent(user.id, meta)
      : await withdrawLocationConsent(user.id, meta);
    if (changed) auditConsent(user, accept, meta.ip);
    revalidatePath('/dong-y-cua-toi');
    return { ok: true, data: { accepted: accept } };
  } catch (error) {
    return toActionError(error);
  }
}
