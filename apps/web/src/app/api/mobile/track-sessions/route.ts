import { after, NextResponse } from 'next/server';
import { trackSessionInput } from '@seedgw/contracts/check-ins';
import { vietnamToday } from '@seedgw/contracts/format';
import { assertMobileCan, mobileRoute, requireMobileUser } from '@/server/auth/mobile';
import { readJson } from '@/server/auth/mobile-request';
import { scheduleCheckInFollowup } from '@/server/integrations/check-in-followup-queue';
import { saveTrackSession } from '@/server/services/check-ins';

// Gửi lúc bắt đầu và lúc kết thúc ghi hành trình. Cùng clientId thì cập nhật dòng cũ.
export const PUT = mobileRoute(async (request: Request) => {
  const user = await requireMobileUser(request);
  assertMobileCan(user, 'sales.check-in.create');
  const input = await readJson(request, trackSessionInput);
  await saveTrackSession(user, input);
  after(() =>
    scheduleCheckInFollowup({ userId: user.id, day: vietnamToday(new Date(input.startedAt)) }),
  );
  return NextResponse.json({ ok: true });
});
