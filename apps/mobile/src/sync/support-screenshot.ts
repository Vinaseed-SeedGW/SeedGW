import { captureScreen } from 'react-native-view-shot';

// Ảnh màn hình để đính kèm yêu cầu hỗ trợ (T3). Chỉ giữ trong bộ nhớ, không lưu máy, không tự gửi:
// người dùng chọn đính kèm thì mới vào hàng đợi.

export type ScreenShot = { base64: string; screen: string; at: number };

let last: ScreenShot | null = null;

/** Chụp màn hình đang hiện, ví dụ ngay trước khi chuyển sang tab Tôi hoặc khi bấm Báo lỗi này. */
export async function rememberScreen(screen: string): Promise<ScreenShot | null> {
  try {
    const base64 = await captureScreen({ format: 'jpg', quality: 0.6, result: 'base64' });
    last = { base64, screen, at: Date.now() };
    return last;
  } catch {
    return null;
  }
}

/** Ảnh vừa chụp trong 10 phút gần nhất, cũ hơn thì bỏ. */
export function recentScreen(now = Date.now()): ScreenShot | null {
  if (!last || now - last.at > 10 * 60_000) return null;
  return last;
}

export function forgetScreen(): void {
  last = null;
}
