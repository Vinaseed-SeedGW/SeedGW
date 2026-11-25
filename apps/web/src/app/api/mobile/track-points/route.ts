import { after, NextResponse } from 'next/server';
import { trackPointsBatchInput } from '@seedgw/contracts/check-ins';
import { assertMobileCan, mobileRoute, requireMobileUser } from '@/server/auth/mobile';
import { readJson } from '@/server/auth/mobile-request';
import { scheduleCheckInFollowup } from '@/server/integrations/check-in-followup-queue';
import { saveTrackPoints } from '@/server/services/check-ins';

// Điểm GPS gửi theo lô, trùng nhân viên và giờ thì bỏ qua (M12).
export const POST = mobileRoute(async (request: Request) => {
  const user = await requireMobileUser(request);
  assertMobileCan(user, 'sales.check-in.create');
  const input = await readJson(request, trackPointsBatchInput);
  const { accepted, days } = await saveTrackPoints(user, input);
  if (accepted > 0) {
    after(async () => {
      for (const day of days) await scheduleCheckInFollowup({ userId: user.id, day });
    });
  }
  return NextResponse.json({ accepted });
});
