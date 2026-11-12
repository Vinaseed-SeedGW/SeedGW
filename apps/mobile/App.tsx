import { useState } from 'react';
import { Platform, SafeAreaView, StatusBar, StyleSheet, View } from 'react-native';
import { TrackingPanel } from './src/components/tracking-panel';
import { useTracking } from './src/components/use-tracking';
import { WatermarkCamera } from './src/components/watermark-camera';
import { COLORS } from './src/theme';

// Bản thử R3: một màn hành trình và máy ảnh. Điều hướng, đăng nhập, tab làm ở M1.
export function App() {
  const control = useTracking();
  const [screen, setScreen] = useState<'tracking' | 'camera'>('tracking');

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.body}>
        {screen === 'camera' ? (
          <WatermarkCamera
            onClose={() => setScreen('tracking')}
            onSaved={() => void control.actions.startIfIdle()}
          />
        ) : (
          <TrackingPanel control={control} onOpenCamera={() => setScreen('camera')} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  body: { flex: 1, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0 },
});
