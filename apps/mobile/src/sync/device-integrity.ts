import { requireOptionalNativeModule } from 'expo';
import type { DeviceIntegrity } from '@dms/contracts/check-ins';

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
