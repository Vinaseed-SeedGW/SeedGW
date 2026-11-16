import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from './text';
import * as Location from 'expo-location';
import type { DealerChoice } from '../api/dealers';
import { COLORS, FONT, SPACE } from '../theme';
import { Button } from './button';
import { DealerResults, toChoice, useDealerSearch } from './dealer-picker';

const VISIBLE_RESULTS = 20;

type Point = { lat: number; lng: number; accuracy: number | null };

/** Lấy vị trí hiện tại một lần: dùng ngay vị trí gần nhất máy có, rồi thay bằng vị trí chính xác. */
function useCurrentPoint() {
  const [point, setPoint] = useState<Point | null>(null);
  const [denied, setDenied] = useState(false);
  const [round, setRound] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!permission.granted) {
          if (!cancelled) setDenied(true);
          return;
        }
        const last = await Location.getLastKnownPositionAsync();
        if (last && !cancelled) {
          setPoint({
            lat: last.coords.latitude,
            lng: last.coords.longitude,
            accuracy: last.coords.accuracy,
          });
        }
        const fresh = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        if (!cancelled) {
          setPoint({
            lat: fresh.coords.latitude,
            lng: fresh.coords.longitude,
            accuracy: fresh.coords.accuracy,
          });
        }
      } catch {
        // Không lấy được vị trí chính xác: giữ vị trí gần nhất nếu có, người dùng bấm Lấy lại vị trí.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [round]);

  return { point, denied, refresh: () => setRound((value) => value + 1) };
}

type Props = {
  onPick: (dealer: DealerChoice) => void;
  onClose: () => void;
};

/**
 * Cách check-in thứ hai (M4): danh sách đại lý mình phụ trách, gần nhất lên đầu. Bấm một đại lý thì mở
 * máy ảnh với đại lý đó đã chọn sẵn. Đại lý chưa có toạ độ nằm cuối danh sách, xếp theo tên.
 */
export function NearbyDealers({ onPick, onClose }: Props) {
  const { point, denied, refresh } = useCurrentPoint();
  const [query, setQuery] = useState('');
  // Làm tròn khoảng 10 m để vị trí nhích nhẹ không gọi lại máy chủ liên tục.
  const rounded = point
    ? { lat: Math.round(point.lat * 10_000) / 10_000, lng: Math.round(point.lng * 10_000) / 10_000 }
    : null;
  const search = useDealerSearch(query, rounded, point !== null);

  return (
    <View style={styles.fill}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Đại lý gần tôi</Text>
        <Text style={styles.muted}>Bấm vào đại lý để mở máy ảnh với đại lý đó đã chọn sẵn.</Text>
        {denied ? (
          <Text style={styles.danger}>
            Chưa có quyền vị trí. Mở Cài đặt và cho phép DMS dùng vị trí.
          </Text>
        ) : null}
        {!denied && !point ? <Text style={styles.muted}>Đang lấy vị trí</Text> : null}
        {point?.accuracy ? (
          <Text style={styles.muted}>Sai số vị trí khoảng {Math.round(point.accuracy)} m</Text>
        ) : null}
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Tìm theo tên, mã, số điện thoại"
          accessibilityLabel="Tìm đại lý"
          style={styles.input}
          autoCorrect={false}
        />
        <DealerResults
          search={search}
          limit={VISIBLE_RESULTS}
          onPick={(dealer) => onPick(toChoice(dealer))}
        />
      </ScrollView>
      <View style={styles.controls}>
        <Button label="Quay lại" onPress={onClose} variant="ghost" />
        <Button label="Lấy lại vị trí" onPress={refresh} variant="ghost" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: COLORS.surface },
  content: { padding: SPACE.lg, gap: SPACE.sm },
  title: { fontSize: 20, fontWeight: FONT.bold, color: COLORS.brand },
  muted: { fontSize: 14, color: COLORS.textMuted },
  danger: { fontSize: 14, color: COLORS.danger },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: SPACE.md,
    fontSize: 16,
    color: COLORS.text,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: SPACE.lg,
    gap: SPACE.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
});
