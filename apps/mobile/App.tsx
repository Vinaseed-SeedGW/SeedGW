import { useEffect, useState } from 'react';
import { useFonts } from 'expo-font';
import brandBold from './assets/fonts/UTMNeoSansIntel-Bold.ttf';
import brandRegular from './assets/fonts/UTMNeoSansIntel-Regular.ttf';
import {
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { logout } from './src/api/client';
import { loadConsentState, recordConsent, type ConsentState } from './src/api/consent';
import { loadCapabilities, type Capabilities } from './src/api/targets';
import { refreshTrackingSettings } from './src/api/tracking-settings';
import type { DealerChoice } from './src/api/dealers';
import { ConsentScreen } from './src/components/consent-screen';
import { stopTracking } from './src/sync/background-tracking';
import { serverEnabled } from './src/api/session';
import { AppHeader } from './src/components/app-header';
import { ApprovalsScreen } from './src/components/approvals-screen';
import { RoutesScreen } from './src/components/routes-screen';
import { SupportScreen, type SupportPrefill } from './src/components/support-screen';
import { readSupportBadge } from './src/api/support';
import { countPendingSupport } from './src/sync/support-outbox';
import { rememberScreen } from './src/sync/support-screenshot';
import { HistoryTab } from './src/components/history-tab';
import { LoginScreen } from './src/components/login-screen';
import { MeTab } from './src/components/me-tab';
import { RouteTab } from './src/components/route-tab';
import { TabBar, TABS, type TabKey } from './src/components/tab-bar';
import { TargetsScreen } from './src/components/targets-screen';
import { TodayTab } from './src/components/today-tab';
import { useTracking } from './src/components/use-tracking';
import { useAutoSync, useSession } from './src/components/use-sync';
import { WatermarkCamera } from './src/components/watermark-camera';
import { Text } from './src/components/text';
import { COLORS, FONT_FAMILY, SPACE } from './src/theme';

// Có địa chỉ máy chủ thì phải đăng nhập (M1) và dữ liệu được gửi lên (M3, M12).
// Chưa có máy chủ thì chạy như bản thử R3, dữ liệu chỉ nằm trên máy.
// Font thương hiệu nằm trong gói cập nhật của app, nạp một lần lúc mở app (M2).
const BRAND_FONTS = {
  [FONT_FAMILY.regular]: brandRegular,
  [FONT_FAMILY.bold]: brandBold,
};

export function App() {
  const { ready: sessionReady, session } = useSession();
  // Nạp font lỗi thì vẫn chạy bằng font hệ thống, không chặn check-in.
  const [fontsLoaded, fontError] = useFonts(BRAND_FONTS);
  const ready = sessionReady && (fontsLoaded || fontError !== null);
  const needsLogin = serverEnabled() && !session;

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.body}>
        {!ready ? (
          <ActivityIndicator style={styles.loading} color={COLORS.brand} />
        ) : needsLogin ? (
          <LoginScreen />
        ) : (
          <Main signedIn={session !== null} />
        )}
      </View>
    </SafeAreaView>
  );
}

function Main({ signedIn }: { signedIn: boolean }) {
  const control = useTracking();
  const sync = useAutoSync(signedIn);
  const { session } = useSession();
  const [tab, setTab] = useState<TabKey>('today');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [presetDealer, setPresetDealer] = useState<DealerChoice | null>(null);
  const [consent, setConsent] = useState<ConsentState | 'checking'>('checking');
  // Màn mở chồng lên tab: Chỉ tiêu của tôi (K3a), Cần duyệt (A10b).
  const [overlay, setOverlay] = useState<'targets' | 'approvals' | 'routes' | 'support' | null>(
    null,
  );
  const [supportPrefill, setSupportPrefill] = useState<SupportPrefill | null>(null);
  const [supportUnread, setSupportUnread] = useState(0);
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!session || overlay !== null) return;
    let cancelled = false;
    void refreshTrackingSettings();
    void loadCapabilities().then((value) => {
      if (!cancelled && value) setCapabilities(value);
    });
    return () => {
      cancelled = true;
    };
  }, [session, overlay, tab]);

  // Số đỏ Hỗ trợ: hỏi khi mở app và mỗi 60 giây khi app đang mở (chưa có thông báo đẩy M7).
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    const load = () =>
      void readSupportBadge().then((count) => {
        if (!cancelled && count !== null) setSupportUnread(count);
      });
    load();
    const timer = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [session, overlay]);

  useEffect(() => {
    let cancelled = false;
    void loadConsentState().then((state) => {
      if (!cancelled) setConsent(state);
    });
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  if (consent === 'checking') {
    return <ActivityIndicator style={styles.loading} color={COLORS.brand} />;
  }
  if (consent === 'needed') {
    return (
      <ConsentScreen
        onAccept={() => {
          setConsent('accepted');
          void recordConsent('ACCEPT');
        }}
        onLogout={session ? () => void stopTracking('USER').then(logout) : null}
      />
    );
  }

  function withdrawConsent() {
    Alert.alert(
      'Rút lại đồng ý chia sẻ vị trí',
      'App sẽ dừng ghi vị trí và bạn không check-in trên app được nữa cho tới khi đồng ý lại.',
      [
        { text: 'Không', style: 'cancel' },
        {
          text: 'Rút lại',
          style: 'destructive',
          onPress: () => {
            void stopTracking('USER')
              .then(() => recordConsent('WITHDRAW'))
              .then(() => setConsent('needed'));
          },
        },
      ],
    );
  }

  function openCamera(dealer: DealerChoice | null) {
    setPresetDealer(dealer);
    setCameraOpen(true);
  }

  // Máy ảnh mở toàn màn hình, che thanh tiêu đề và thanh tab.
  if (cameraOpen) {
    return (
      <WatermarkCamera
        presetDealer={presetDealer}
        onClose={() => {
          setPresetDealer(null);
          setCameraOpen(false);
          sync.actions.refreshCounts();
        }}
        onSaved={() => void control.actions.startIfIdle()}
      />
    );
  }

  const account = session ? { user: session.user, sync } : null;

  // Chụp màn hình tab đang xem trước khi sang tab Tôi, để đính kèm khi báo lỗi (người dùng chọn mới gửi).
  function changeTab(next: TabKey) {
    if (next === 'me' && tab !== 'me' && account) {
      const label = TABS.find((item) => item.key === tab)?.label ?? '';
      void rememberScreen(label).finally(() => setTab(next));
      return;
    }
    setTab(next);
  }

  function reportProblem(detail: string) {
    void rememberScreen('Hôm nay').then((screenshot) => {
      setSupportPrefill({
        title: 'Lỗi gửi dữ liệu check-in',
        body: detail,
        context: { screen: 'Hôm nay' },
        screenshot,
      });
      setOverlay('support');
    });
  }
  const closeOverlay = () => {
    setOverlay(null);
    setSupportPrefill(null);
    setRefreshKey((value) => value + 1);
  };
  if (overlay && account) {
    return (
      <View style={styles.fill}>
        <AppHeader title={OVERLAY_TITLE[overlay]} />
        {overlay === 'targets' ? <TargetsScreen onClose={closeOverlay} /> : null}
        {overlay === 'approvals' ? <ApprovalsScreen onClose={closeOverlay} /> : null}
        {overlay === 'routes' ? <RoutesScreen onClose={closeOverlay} /> : null}
        {overlay === 'support' ? (
          <SupportScreen onClose={closeOverlay} prefill={supportPrefill} />
        ) : null}
      </View>
    );
  }
  return (
    <View style={styles.fill}>
      <AppHeader title={TABS.find((item) => item.key === tab)?.label ?? ''} />
      <View style={styles.fill}>
        {tab === 'today' ? (
          <TodayTab
            control={control}
            sync={account ? sync : null}
            onOpenCamera={() => openCamera(null)}
            onPickDealer={openCamera}
            onOpenRoute={account ? () => setTab('route') : null}
            onOpenTargets={account ? () => setOverlay('targets') : null}
            onReportProblem={account ? reportProblem : null}
            refreshKey={refreshKey}
          />
        ) : null}
        {tab === 'route' ? (
          account ? (
            <RouteTab
              onPick={openCamera}
              onOpenRoutes={() => setOverlay('routes')}
              refreshKey={refreshKey}
            />
          ) : (
            <Text style={styles.notice}>Cần đăng nhập máy chủ để xem đại lý phụ trách.</Text>
          )
        ) : null}
        {tab === 'history' ? <HistoryTab /> : null}
        {tab === 'me' ? (
          <MeTab
            control={control}
            account={account}
            onWithdrawConsent={withdrawConsent}
            approvals={
              capabilities?.canReviewApprovals
                ? {
                    pendingCount: capabilities.pendingApprovalCount,
                    onOpen: () => setOverlay('approvals'),
                  }
                : null
            }
            support={
              account
                ? {
                    unreadCount: supportUnread,
                    pendingCount: countPendingSupport(),
                    onOpen: () => setOverlay('support'),
                  }
                : null
            }
          />
        ) : null}
      </View>
      <TabBar active={tab} onChange={changeTab} badges={{ me: supportUnread }} />
    </View>
  );
}

const OVERLAY_TITLE = {
  targets: 'Chỉ tiêu',
  approvals: 'Cần duyệt',
  routes: 'Tuyến',
  support: 'Hỗ trợ',
} as const;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  body: { flex: 1, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0 },
  loading: { marginTop: 80 },
  fill: { flex: 1 },
  notice: { padding: SPACE.lg, fontSize: 15, color: COLORS.textMuted },
});
