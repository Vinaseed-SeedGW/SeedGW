import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import { ANDROID_PUSH_CHANNEL, pushTarget, type PushTarget } from '@seedgw/contracts/push';
import appConfig from '../../app.json';
import { apiCall } from '../api/client';

// Thông báo đẩy trên app (M7). Không import thẳng expo-notifications: bản cài cũ chưa có phần gốc của
// thư viện này, import thẳng làm bản cập nhật lỗi lúc mở (xem scripts/check-native-imports.mjs).

type Notifications = typeof import('expo-notifications');

export type PushState = 'GRANTED' | 'DENIED' | 'UNDETERMINED' | 'UNSUPPORTED';

const PROJECT_ID = appConfig.expo.extra.eas.projectId;

let loaded: Promise<Notifications | null> | null = null;

function load(): Promise<Notifications | null> {
  loaded ??= (async () => {
    if (!requireOptionalNativeModule('ExpoPushTokenManager')) return null;
    try {
      const module = await import('expo-notifications');
      // Đang mở app mà có thông báo thì vẫn hiện ở đầu màn hình.
      module.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
      if (Platform.OS === 'android') {
        await module.setNotificationChannelAsync(ANDROID_PUSH_CHANNEL.id, {
          name: ANDROID_PUSH_CHANNEL.name,
          importance: module.AndroidImportance.HIGH,
        });
      }
      return module;
    } catch {
      return null;
    }
  })();
  return loaded;
}

export async function readPushState(): Promise<PushState> {
  const module = await load();
  if (!module) return 'UNSUPPORTED';
  const { status } = await module.getPermissionsAsync();
  return status === 'granted' ? 'GRANTED' : status === 'denied' ? 'DENIED' : 'UNDETERMINED';
}

/**
 * Xin quyền (lần đầu hiện hộp thoại của hệ điều hành) và gửi mã nhận thông báo lên máy chủ.
 * Gọi khi đã đăng nhập và mỗi lần mở app; lỗi thì bỏ qua, lần sau thử lại.
 */
export async function registerForPush(): Promise<PushState> {
  const module = await load();
  if (!module) return 'UNSUPPORTED';
  let { status } = await module.getPermissionsAsync();
  if (status === 'undetermined') status = (await module.requestPermissionsAsync()).status;
  if (status !== 'granted') return status === 'denied' ? 'DENIED' : 'UNDETERMINED';
  try {
    const { data: token } = await module.getExpoPushTokenAsync({ projectId: PROJECT_ID });
    await apiCall('/api/mobile/push-token', {
      method: 'POST',
      json: { token, platform: Platform.OS === 'ios' ? 'ios' : 'android' },
    });
  } catch {
    // Android chưa có cấu hình Firebase thì chưa lấy được mã; không ảnh hưởng phần khác của app.
  }
  return 'GRANTED';
}

function targetOf(data: unknown): PushTarget | null {
  const parsed = pushTarget.safeParse((data as { target?: unknown } | null)?.target);
  return parsed.success ? parsed.data : null;
}

/**
 * Người dùng bấm thông báo: gọi onOpen với màn cần mở. Cả khi app đang tắt hẳn rồi được mở từ thông báo.
 * Trả hàm huỷ nghe.
 */
export function onPushOpened(onOpen: (target: PushTarget) => void): () => void {
  let remove = () => {};
  let cancelled = false;
  void load().then(async (module) => {
    if (!module || cancelled) return;
    const subscription = module.addNotificationResponseReceivedListener((response) => {
      const target = targetOf(response.notification.request.content.data);
      if (target) onOpen(target);
    });
    remove = () => subscription.remove();
    const last = await module.getLastNotificationResponseAsync();
    if (last && !cancelled) {
      const target = targetOf(last.notification.request.content.data);
      await module.clearLastNotificationResponseAsync();
      if (target) onOpen(target);
    }
  });
  return () => {
    cancelled = true;
    remove();
  };
}
