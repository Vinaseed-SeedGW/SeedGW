import { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { serverEnabled } from './src/api/session';
import { LoginScreen } from './src/components/login-screen';
import { TrackingPanel } from './src/components/tracking-panel';
import { useTracking } from './src/components/use-tracking';
import { useAutoSync, useSession } from './src/components/use-sync';
import { WatermarkCamera } from './src/components/watermark-camera';
import { COLORS } from './src/theme';

// Có địa chỉ máy chủ thì phải đăng nhập (M1) và dữ liệu được gửi lên (M3, M12).
// Chưa có máy chủ thì chạy như bản thử R3, dữ liệu chỉ nằm trên máy.
export function App() {
  const { ready, session } = useSession();
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
  const [screen, setScreen] = useState<'tracking' | 'camera'>('tracking');

  if (screen === 'camera') {
    return (
      <WatermarkCamera
        onClose={() => {
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
      account={session ? { user: session.user, sync } : null}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  body: { flex: 1, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0 },
  loading: { marginTop: 80 },
});
