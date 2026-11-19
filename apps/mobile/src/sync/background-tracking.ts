import { AppState } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { COLORS } from '../theme';
import { vnHour } from './geo';
import { syncNow } from './sync-queue';
import {
  closeSession,
  getConsentAt,
  getTrackingSettings,
  insertTrackPoints,
  openSession,
  recordTaskError,
  type SessionEndReason,
} from './track-db';
import { APP_NAME } from '@dms/config/brand';

export const TRACKING_TASK = 'dms-ghi-hanh-trinh';

// Số liệu cố định theo CHECK_IN_PLAN §3.1, §3.5. Chu kỳ ghi và giờ tự dừng lấy từ Tham số (A9b).
export const TRACKING_CONFIG = {
  distanceIntervalM: 10,
  batchIntervalMs: 30_000,
} as const;

type TaskData = { locations?: Location.LocationObject[] };

// Phải đăng ký ở phạm vi module, trước khi app render, để hệ điều hành gọi lại được khi app ở nền.
const SYNC_FROM_BACKGROUND_MS = 60_000;

TaskManager.defineTask<TaskData>(TRACKING_TASK, async ({ data, error }) => {
  if (error) {
    recordTaskError(`${error.code}: ${error.message}`);
    return;
  }
  const locations = data.locations ?? [];
  try {
    const beforeCutoff = locations.filter(
      (l) => vnHour(l.timestamp) < getTrackingSettings().autoStopHourVn,
    );
    insertTrackPoints(beforeCutoff, AppState.currentState ?? null);
    if (
      beforeCutoff.length < locations.length ||
      vnHour(Date.now()) >= getTrackingSettings().autoStopHourVn
    ) {
      await stopTracking('AUTO_CUTOFF');
    }
    // Gửi lô điểm khoảng mỗi phút ngay trong tác vụ nền (M12), lỗi mạng thì lần sau gửi tiếp.
    await syncNow(SYNC_FROM_BACKGROUND_MS);
  } catch (cause) {
    recordTaskError(cause instanceof Error ? cause.message : String(cause));
  }
});

export type StartResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        'NO_CONSENT' | 'SERVICES_OFF' | 'FOREGROUND_DENIED' | 'BACKGROUND_DENIED' | 'AFTER_CUTOFF';
    };

export async function isTracking(): Promise<boolean> {
  return Location.hasStartedLocationUpdatesAsync(TRACKING_TASK);
}

export async function startTracking(): Promise<StartResult> {
  if (getConsentAt() === null) return { ok: false, reason: 'NO_CONSENT' };
  if (vnHour(Date.now()) >= getTrackingSettings().autoStopHourVn)
    return { ok: false, reason: 'AFTER_CUTOFF' };
  if (!(await Location.hasServicesEnabledAsync())) return { ok: false, reason: 'SERVICES_OFF' };

  const foreground = await Location.requestForegroundPermissionsAsync();
  if (!foreground.granted) return { ok: false, reason: 'FOREGROUND_DENIED' };
  const background = await Location.requestBackgroundPermissionsAsync();
  if (!background.granted) return { ok: false, reason: 'BACKGROUND_DENIED' };

  if (!(await isTracking())) {
    await Location.startLocationUpdatesAsync(TRACKING_TASK, {
      // Không dùng mức chính xác cao nhất để đỡ hao pin (CHECK_IN_PLAN §8).
      accuracy: Location.Accuracy.High,
      // Chu kỳ lấy từ Tham số lúc bắt đầu ghi; đổi giữa chừng thì áp từ lần ghi sau (A9b).
      timeInterval: getTrackingSettings().intervalSeconds * 1000,
      distanceInterval: TRACKING_CONFIG.distanceIntervalM,
      deferredUpdatesInterval: TRACKING_CONFIG.batchIntervalMs,
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.AutomotiveNavigation,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: `${APP_NAME} đang ghi hành trình`,
        notificationBody: 'Ghi vị trí trong giờ làm việc để tính km giữa các điểm check-in.',
        notificationColor: COLORS.brand,
        killServiceOnDestroy: false,
      },
    });
  }
  openSession(Date.now());
  return { ok: true };
}

export async function stopTracking(reason: SessionEndReason): Promise<void> {
  if (await isTracking()) await Location.stopLocationUpdatesAsync(TRACKING_TASK);
  closeSession(Date.now(), reason);
}

/** Gọi mỗi lần mở app: đứng yên sau giờ dừng thì không có điểm mới để task tự dừng. */
export async function enforceAutoStop(): Promise<void> {
  if (vnHour(Date.now()) >= getTrackingSettings().autoStopHourVn && (await isTracking())) {
    await stopTracking('AUTO_CUTOFF');
  }
}

export async function describeLocationPermission(): Promise<'ALWAYS' | 'WHEN_IN_USE' | 'DENIED'> {
  const [foreground, background] = await Promise.all([
    Location.getForegroundPermissionsAsync(),
    Location.getBackgroundPermissionsAsync(),
  ]);
  if (background.granted) return 'ALWAYS';
  if (foreground.granted) return 'WHEN_IN_USE';
  return 'DENIED';
}
