import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from './text';
import * as Location from 'expo-location';
import type { DealerChoice } from '../api/dealers';
import { startOfVnDay } from '../sync/geo';
import { readLocalHistory } from '../sync/track-db';
import { COLORS, FONT, SPACE } from '../theme';
import { Button } from './button';
import { DealerResults, toChoice, useDealerSearch } from './dealer-picker';

const VISIBLE_RESULTS = 30;
const DAY_MS = 86_400_000;

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
};

/**
 * Tab Tuyến (M6): đại lý mình phụ trách, gần nhất lên đầu, đánh dấu đại lý đã ghé hôm nay. Bấm một đại lý
 * thì mở máy ảnh với đại lý đó đã chọn sẵn (cách check-in thứ hai, M4). Đại lý chưa có toạ độ nằm cuối,
 * xếp theo tên. Đăng ký tuyến tuần hoặc ngày và nút Chỉ đường làm ở S8.
 */
export function RouteTab({ onPick }: Props) {
  const { point, denied, refresh } = useCurrentPoint();
  const visited = useMemo(() => {
    const dayStart = startOfVnDay(Date.now());
    return new Set(
      readLocalHistory(dayStart, dayStart + DAY_MS).flatMap((row) =>
        row.dealerId ? [row.dealerId] : [],
      ),
    );
  }, []);
  const [query, setQuery] = useState('');
  // Làm tròn khoảng 10 m để vị trí nhích nhẹ không gọi lại máy chủ liên tục.
  const rounded = point
    ? { lat: Math.round(point.lat * 10_000) / 10_000, lng: Math.round(point.lng * 10_000) / 10_000 }
    : null;
  const search = useDealerSearch(query, rounded, point !== null);

  return (
    <View style={styles.fill}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Đại lý tôi phụ trách</Text>
        <Text style={styles.muted}>
          Gần nhất lên đầu. Bấm vào đại lý để mở máy ảnh với đại lý đó đã chọn sẵn. Đăng ký tuyến
          theo tuần hoặc theo ngày và chỉ đường Google Maps sẽ có ở bản sau.
        </Text>
        {denied ? (
          <Text style={styles.danger}>
            Chưa có quyền vị trí. Mở Cài đặt và cho phép DMS dùng vị trí.
          </Text>
        ) : null}
        {!denied && !point ? <Text style={styles.muted}>Đang lấy vị trí</Text> : null}
        <View style={styles.locationRow}>
          <Text style={[styles.muted, styles.flex]}>
            {point?.accuracy ? `Sai số vị trí khoảng ${Math.round(point.accuracy)} m` : ''}
          </Text>
          <Button label="Lấy lại vị trí" onPress={refresh} variant="ghost" />
        </View>
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
          visitedIds={visited}
        />
      </ScrollView>
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
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  flex: { flex: 1 },
});
