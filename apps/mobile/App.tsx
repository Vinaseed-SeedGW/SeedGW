import { useState } from 'react';
import { useFonts } from 'expo-font';
import brandBold from './assets/fonts/UTMNeoSansIntel-Bold.ttf';
import brandRegular from './assets/fonts/UTMNeoSansIntel-Regular.ttf';
import {
  ActivityIndicator,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import type { DealerChoice } from './src/api/dealers';
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
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  body: { flex: 1, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0 },
  loading: { marginTop: 80 },
});
