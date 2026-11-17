import { z } from 'zod';
import type { SystemSettings } from './settings';
import { FILTER, type TrackFilter } from './track-distance';

/** Tham số ghi hành trình app lấy từ máy chủ và lưu trên máy (A9b). */
export const mobileTrackingSettings = z.object({
  autoStopHourVn: z.number().int().min(0).max(23),
  intervalSeconds: z.number().int().positive(),
  maxAccuracyM: z.number().positive(),
  stopRadiusM: z.number().positive(),
  stopMinSeconds: z.number().positive(),
});
export type MobileTrackingSettings = z.infer<typeof mobileTrackingSettings>;

/** Dùng khi app chưa lấy được tham số lần nào; trùng giá trị mặc định ở Tham số. */
export const DEFAULT_TRACKING_SETTINGS: MobileTrackingSettings = {
  autoStopHourVn: 20,
  intervalSeconds: 5,
  maxAccuracyM: FILTER.maxAccuracyM,
  stopRadiusM: FILTER.stopRadiusM,
  stopMinSeconds: FILTER.stopMinSeconds,
};

export function trackingSettingsFrom(values: SystemSettings): MobileTrackingSettings {
  return {
    autoStopHourVn: values.trackingAutoStopHour,
    intervalSeconds: values.trackingIntervalSeconds,
    maxAccuracyM: values.gpsMaxAccuracyM,
    stopRadiusM: values.gpsStopRadiusM,
    stopMinSeconds: values.gpsStopMinSeconds,
  };
}

/** Bộ lọc km theo GPS: sai số và gộp chỗ dừng theo tham số, các ngưỡng khác giữ cố định. */
export function trackFilterOf(settings: MobileTrackingSettings): TrackFilter {
  return {
    ...FILTER,
    maxAccuracyM: settings.maxAccuracyM,
    stopRadiusM: settings.stopRadiusM,
    stopMinSeconds: settings.stopMinSeconds,
  };
}
