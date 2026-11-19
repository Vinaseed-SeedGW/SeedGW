import { requireOptionalNativeModule } from 'expo';
import type { DeviceIntegrity } from '@seedgw/contracts/check-ins';

let cached: Promise<DeviceIntegrity> | null = null;

/**
 * Máy đã root hoặc jailbreak (M5), kiểm một lần mỗi lần mở app. Cách kiểm của Expo là đoán theo dấu hiệu
 * thường gặp nên chỉ dùng để gắn cờ, không chặn. Bản cập nhật chạy trên APK cũ chưa có phần native thì báo
 * không rõ, không gọi để tránh app bị tắt.
 */
export function getDeviceIntegrity(): Promise<DeviceIntegrity> {
  cached ??= (async (): Promise<DeviceIntegrity> => {
    if (!requireOptionalNativeModule('ExpoDevice')) return 'UNKNOWN';
    try {
      const Device = await import('expo-device');
      return (await Device.isRootedExperimentalAsync()) ? 'ROOTED' : 'OK';
    } catch {
      return 'UNKNOWN';
    }
  })();
  return cached;
}

let model: Promise<string | undefined> | null = null;

/** Hãng và đời máy để gắn vào yêu cầu hỗ trợ (T3). Bản cài chưa có phần native thì bỏ trống, không làm app tắt. */
export function getDeviceModel(): Promise<string | undefined> {
  model ??= (async () => {
    if (!requireOptionalNativeModule('ExpoDevice')) return undefined;
    try {
      const Device = await import('expo-device');
      return [Device.manufacturer, Device.modelName].filter(Boolean).join(' ') || undefined;
    } catch {
      return undefined;
    }
  })();
  return model;
}
