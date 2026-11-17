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
import type { DealerChoice } from './src/api/dealers';
import { ConsentScreen } from './src/components/consent-screen';
import { stopTracking } from './src/sync/background-tracking';
import { serverEnabled } from './src/api/session';
import { NearbyDealers } from './src/components/nearby-dealers';
import { LoginScreen } from './src/components/login-screen';
import { TrackingPanel } from './src/components/tracking-panel';
import { useTracking } from './src/components/use-tracking';
import { useAutoSync, useSession } from './src/components/use-sync';
import { WatermarkCamera } from './src/components/watermark-camera';
import { COLORS, FONT_FAMILY } from './src/theme';

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
  const [screen, setScreen] = useState<'tracking' | 'camera' | 'nearby'>('tracking');
  const [presetDealer, setPresetDealer] = useState<DealerChoice | null>(null);
  const [consent, setConsent] = useState<ConsentState | 'checking'>('checking');

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

  if (screen === 'nearby') {
    return (
      <NearbyDealers
        onClose={() => setScreen('tracking')}
        onPick={(dealer) => {
          setPresetDealer(dealer);
          setScreen('camera');
        }}
      />
    );
  }
  if (screen === 'camera') {
    return (
      <WatermarkCamera
        presetDealer={presetDealer}
        onClose={() => {
          setPresetDealer(null);
          setScreen('tracking');
          sync.actions.refreshCounts();
        }}
        onSaved={() => void control.actions.startIfIdle()}
      />
    );
  }
  return (
    <TrackingPanel
      control={control}
      onOpenCamera={() => setScreen('camera')}
      onOpenNearby={session ? () => setScreen('nearby') : null}
      account={session ? { user: session.user, sync } : null}
      onWithdrawConsent={withdrawConsent}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  body: { flex: 1, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0 },
  loading: { marginTop: 80 },
});
