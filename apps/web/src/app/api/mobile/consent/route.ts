import { after, NextResponse } from 'next/server';
import { auditChanges } from '@seedgw/contracts/audit';
import { LOCATION_CONSENT_VERSION, mobileConsentInput } from '@seedgw/contracts/consents';
import { mobileError, mobileRoute, requireMobileUser } from '@/server/auth/mobile';
import { clientIp, readJson } from '@/server/auth/mobile-request';
import { writeAudit } from '@/server/services/audit';
import {
  acceptLocationConsent,
  readLocationConsent,
  withdrawLocationConsent,
} from '@/server/services/consents';

// Lời đồng ý chia sẻ vị trí của chính người dùng app (17/11/2026).
export const GET = mobileRoute(async (request: Request) => {
  const user = await requireMobileUser(request);
  return NextResponse.json(await readLocationConsent(user.id));
});

export const POST = mobileRoute(async (request: Request) => {
  const user = await requireMobileUser(request);
  const input = await readJson(request, mobileConsentInput);
  // App cũ gửi bản câu chữ cũ thì không ghi, app sẽ hỏi lại bằng bản mới.
  if (input.version !== LOCATION_CONSENT_VERSION) {
    return mobileError('CONFLICT', 'Lời đồng ý đã có bản mới, vui lòng cập nhật app');
  }
  const ip = clientIp(request);
  const changed =
    input.action === 'ACCEPT'
      ? await acceptLocationConsent(user.id, 'APP', ip)
      : await withdrawLocationConsent(user.id);
  if (changed) {
    after(() =>
      writeAudit({
        actor: { id: user.id, impersonator: null },
        action: input.action === 'ACCEPT' ? 'consent.accept' : 'consent.withdraw',
        entityType: 'User',
        entityId: user.id,
        entityLabel: user.employeeCode,
        changes: auditChanges(
          {},
          {
            'Đồng ý chia sẻ vị trí': `${input.action === 'ACCEPT' ? 'Đồng ý' : 'Rút lại'}, bản ${LOCATION_CONSENT_VERSION}, trên app`,
          },
        ),
        ip,
      }),
    );
  }
  return NextResponse.json(await readLocationConsent(user.id));
});
