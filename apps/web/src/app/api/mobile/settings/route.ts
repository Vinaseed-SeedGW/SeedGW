import { NextResponse } from 'next/server';
import { trackingSettingsFrom } from '@dms/contracts/tracking-settings';
import { mobileRoute, requireMobileUser } from '@/server/auth/mobile';
import { readSystemSettings } from '@/server/services/settings';

// Tham số ghi hành trình (A9b). App gọi khi mở có mạng, lưu trên máy để dùng lúc mất mạng.
export const GET = mobileRoute(async (request: Request) => {
  await requireMobileUser(request);
  const settings = await readSystemSettings();
  return NextResponse.json({ tracking: trackingSettingsFrom(settings.values) });
});
