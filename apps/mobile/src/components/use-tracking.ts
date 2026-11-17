import { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, Linking, Platform } from 'react-native';
import {
  describeLocationPermission,
  enforceAutoStop,
  isTracking,
  startTracking,
  stopTracking,
  type StartResult,
} from '../sync/background-tracking';
import { getConsentAt, getLastPointAt } from '../sync/track-db';

// iOS dừng ghi vị trí khi người dùng vuốt tắt app. App mở lại từ đầu (không phải từ chạy nền)
// trong lúc đang ghi mà điểm cuối đã cũ thì báo đoạn bị đứt, để người dùng biết và lần sau không tắt app.
const GAP_WARNING_MS = 3 * 60_000;
let coldStartChecked = false;

function formatTime(at: number): string {
  const date = new Date(at + 7 * 3_600_000);
  return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
}

function coldStartGapWarning(active: boolean): string | null {
  if (coldStartChecked) return null;
  coldStartChecked = true;
  if (Platform.OS !== 'ios' || !active) return null;
  const last = getLastPointAt();
  if (last === null || Date.now() - last < GAP_WARNING_MS) return null;
  return `App đã bị tắt trong lúc ghi hành trình, điểm vị trí cuối lúc ${formatTime(last)}. Đoạn đường lúc app tắt có thể không được tính km. Khi đang ghi, chỉ khoá màn hình hoặc chuyển app, không vuốt tắt app.`;
}

export type PermissionLevel = Awaited<ReturnType<typeof describeLocationPermission>>;

const START_ERRORS: Record<Exclude<StartResult, { ok: true }>['reason'], string> = {
  NO_CONSENT: 'Cần đồng ý cho ghi vị trí trong giờ làm việc trước khi ghi hành trình.',
  SERVICES_OFF: 'Định vị trên điện thoại đang tắt. Bật định vị rồi thử lại.',
  FOREGROUND_DENIED: 'Chưa có quyền vị trí. Mở Cài đặt và cho phép DMS dùng vị trí.',
  BACKGROUND_DENIED:
    Platform.OS === 'ios'
      ? 'Cần quyền vị trí Luôn luôn để ghi hành trình khi app chạy nền. Mở Cài đặt, chọn Vị trí, chọn Luôn luôn.'
      : 'Cần quyền vị trí Luôn cho phép để ghi hành trình khi app chạy nền. Mở Cài đặt, chọn Quyền, Vị trí, Luôn cho phép.',
  AFTER_CUTOFF: 'Đã quá giờ tự dừng trong Tham số, app không ghi hành trình sau giờ này.',
};

function ask(title: string, message: string, confirmLabel: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: 'Không', style: 'cancel', onPress: () => resolve(false) },
        { text: confirmLabel, onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

// Lời đồng ý chia sẻ vị trí hỏi ở màn riêng trước khi vào app (consent-screen), ở đây chỉ kiểm tra lại.
function ensureConsent(): boolean {
  return getConsentAt() !== null;
}

export function useTracking() {
  const [tracking, setTracking] = useState(false);
  const [permission, setPermission] = useState<PermissionLevel>('DENIED');
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    await enforceAutoStop();
    const [active, level] = await Promise.all([isTracking(), describeLocationPermission()]);
    setTracking(active);
    setPermission(level);
    const warning = coldStartGapWarning(active);
    if (warning) setMessage(warning);
  }, []);

  useEffect(() => {
    void refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  const start = useCallback(async () => {
    setMessage(null);
    if (!ensureConsent()) {
      setMessage(START_ERRORS.NO_CONSENT);
      return;
    }
    if ((await describeLocationPermission()) !== 'ALWAYS') {
      const go = await ask(
        'Quyền vị trí khi chạy nền',
        Platform.OS === 'ios'
          ? 'Ở bước tiếp theo, hãy chọn Luôn luôn để app ghi được hành trình khi tắt màn hình.'
          : 'Ở bước tiếp theo, hãy chọn Luôn cho phép để app ghi được hành trình khi tắt màn hình.',
        'Tiếp tục',
      );
      if (!go) return;
    }
    const result = await startTracking();
    if (!result.ok) {
      setMessage(START_ERRORS[result.reason]);
      if (result.reason === 'FOREGROUND_DENIED' || result.reason === 'BACKGROUND_DENIED') {
        const open = await ask('Mở Cài đặt', START_ERRORS[result.reason], 'Mở Cài đặt');
        if (open) await Linking.openSettings();
      }
    }
    await refresh();
  }, [refresh]);

  /** Lượt check-in đầu tiên trong ngày tự bật ghi hành trình (CHECK_IN_PLAN §3.5). */
  const startIfIdle = useCallback(async () => {
    if (!(await isTracking())) await start();
  }, [start]);

  const stop = useCallback(async () => {
    const confirmed = await ask('Kết thúc ngày', 'Dừng ghi hành trình hôm nay?', 'Kết thúc');
    if (!confirmed) return;
    await stopTracking('USER');
    await refresh();
  }, [refresh]);

  return {
    state: { tracking, permission, message },
    actions: { start, startIfIdle, stop, refresh },
  };
}

export type TrackingControl = ReturnType<typeof useTracking>;
