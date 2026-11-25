import * as Updates from 'expo-updates';
import { Platform } from 'react-native';
import { apiCall } from '../api/client';

// F9: lỗi JS chưa bắt được trên app gửi về máy chủ, xem ở Quản trị › Lỗi hệ thống. Mỗi lần mở app gửi tối đa
// 10 lỗi, lỗi trùng nội dung chỉ gửi một lần; chưa đăng nhập hoặc mất mạng thì bỏ qua.
const MAX_REPORTS_PER_SESSION = 10;
const sent = new Set<string>();

type GlobalHandler = (error: unknown, isFatal?: boolean) => void;
type ErrorUtilsLike = {
  getGlobalHandler: () => GlobalHandler;
  setGlobalHandler: (handler: GlobalHandler) => void;
};

function appVersion(): string {
  const runtime = Updates.runtimeVersion ?? 'chạy thử';
  return Updates.updateId ? `${runtime}, cập nhật ${Updates.updateId.slice(0, 8)}` : runtime;
}

export async function reportAppError(error: unknown, fatal: boolean, screen?: string) {
  const message = error instanceof Error ? error.message || error.name : String(error);
  if (sent.has(message) || sent.size >= MAX_REPORTS_PER_SESSION) return;
  sent.add(message);
  await apiCall('/api/mobile/errors', {
    method: 'POST',
    json: {
      message: message.slice(0, 1000),
      stack: error instanceof Error && error.stack ? error.stack.slice(0, 8000) : null,
      screen: screen ?? null,
      appVersion: appVersion(),
      platform: Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : null,
      fatal,
    },
  }).catch(() => undefined);
}

let installed = false;

/** Gắn một lần khi mở app; vẫn gọi trình xử lý cũ để app hành xử như trước. */
export function installErrorReporter() {
  if (installed) return;
  const utils = (globalThis as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils;
  if (!utils) return;
  installed = true;
  const previous = utils.getGlobalHandler();
  utils.setGlobalHandler((error, isFatal) => {
    void reportAppError(error, Boolean(isFatal));
    previous(error, isFatal);
  });
}
