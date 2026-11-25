import { after, NextResponse } from 'next/server';
import { auditChanges } from '@seedgw/contracts/audit';
import {
  CHECK_IN_PLACE_KIND_LABEL,
  createCheckInInput,
  mobileHistoryQuery,
} from '@seedgw/contracts/check-ins';
import { vietnamToday } from '@seedgw/contracts/format';
import { assertMobileCan, mobileError, mobileRoute, requireMobileUser } from '@/server/auth/mobile';
import { scheduleCheckInFollowup } from '@/server/integrations/check-in-followup-queue';
import { clientIp, readJson } from '@/server/auth/mobile-request';
import { writeAudit } from '@/server/services/audit';
import { clockSkewFromHeader, saveCheckIn } from '@/server/services/check-ins';
import { listMyCheckIns } from '@/server/services/mobile-history';

// Lịch sử check-in của chính nhân viên theo tháng (M6), giữ 18 tháng.
export const GET = mobileRoute(async (request: Request) => {
  const user = await requireMobileUser(request);
  const parsed = mobileHistoryQuery.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!parsed.success) return mobileError('VALIDATION', 'Tháng không hợp lệ');
  return NextResponse.json(await listMyCheckIns(user, parsed.data.month));
});

export const POST = mobileRoute(async (request: Request) => {
  const user = await requireMobileUser(request);
  assertMobileCan(user, 'sales.check-in.create');
  const input = await readJson(request, createCheckInInput);

  const skew = clockSkewFromHeader(request.headers.get('x-device-time'));
  const { receipt, created, id } = await saveCheckIn(user, input, skew);
  if (created) {
    const ip = clientIp(request);
    after(async () => {
      await writeAudit({
        actor: { id: user.id, impersonator: null },
        action: 'check-in.create',
        entityType: 'CheckIn',
        entityId: id,
        entityLabel: `${user.employeeCode}, ${input.placeName}`,
        changes: auditChanges(
          {},
          { placeKind: CHECK_IN_PLACE_KIND_LABEL[input.placeKind], name: input.placeName },
        ),
        ip,
      });
      await scheduleCheckInFollowup({
        userId: user.id,
        day: vietnamToday(new Date(input.capturedAt)),
      });
    });
  }
  return NextResponse.json(receipt, { status: created ? 201 : 200 });
});
