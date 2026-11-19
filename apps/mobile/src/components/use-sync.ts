import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import type { MobileSession } from '@seedgw/contracts/check-ins';
import { loadSession, onSessionChange, serverEnabled } from '../api/session';
import { syncNow } from '../sync/sync-queue';
import { countPending, saveTesterProfile, type PendingCounts } from '../sync/track-db';

const SYNC_EVERY_MS = 60_000;

/** Phiên đăng nhập app. `ready` false trong lúc đọc vùng bảo mật lần đầu. */
export function useSession() {
  const [state, setState] = useState<{ ready: boolean; session: MobileSession | null }>({
    ready: !serverEnabled(),
    session: null,
  });

  useEffect(() => {
    if (!serverEnabled()) return;
    let active = true;
    const apply = (session: MobileSession | null) => {
      if (!active) return;
      // File Excel trên app lấy tên, mã, đơn vị theo tài khoản đã đăng nhập.
      if (session) {
        saveTesterProfile({
          employeeCode: session.user.employeeCode,
          employeeName: session.user.fullName,
          orgUnitName: session.user.orgUnitName ?? '',
        });
      }
      setState({ ready: true, session });
    };
    void loadSession().then(apply);
    const unsubscribe = onSessionChange(apply);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return state;
}

/** Gửi dữ liệu chờ khi mở app, khi quay lại app và mỗi phút. */
export function useAutoSync(enabled: boolean) {
  const [pending, setPending] = useState<PendingCounts>(countPending);
  const [syncing, setSyncing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setSyncing(true);
    const report = await syncNow();
    setSyncing(false);
    if (report.ran) setLastError(report.error);
    setPending(countPending());
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void run();
    const timer = setInterval(() => void run(), SYNC_EVERY_MS);
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void run();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [enabled, run]);

  return {
    state: { pending, syncing, lastError },
    actions: { syncNow: run, refreshCounts: () => setPending(countPending()) },
  };
}

export type SyncControl = ReturnType<typeof useAutoSync>;
