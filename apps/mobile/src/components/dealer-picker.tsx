import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, TextInput } from './text';
import { DEALER_LEVEL_LABEL, type MobileDealerOption } from '@dms/contracts/dealers';
import { searchDealers, type DealerChoice } from '../api/dealers';
import { COLORS, FONT, SPACE } from '../theme';

const SEARCH_DELAY_MS = 350;
const DEFAULT_VISIBLE = 8;
// Mất mạng lúc tìm thì tự tìm lại sau mỗi khoảng này, để không phải gõ tên tay (lỗi ngày thử 16/11).
const RETRY_DELAY_MS = 5_000;
const MAX_AUTO_RETRIES = 6;

export function distanceText(meters: number | null): string {
  if (meters === null) return '';
  return meters < 1000 ? `${meters} m` : `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}

export function toChoice(dealer: MobileDealerOption): DealerChoice {
  return { id: dealer.id, name: dealer.name, lat: dealer.lat, lng: dealer.lng };
}

type SearchState = {
  items: MobileDealerOption[];
  message: string | null;
  loading: boolean;
  failed: boolean;
  retry: () => void;
};

/** Tìm đại lý trong phạm vi của nhân viên, gần nhất lên đầu; lỗi mạng thì tự thử lại. */
export function useDealerSearch(
  query: string,
  point: { lat: number; lng: number } | null,
  enabled: boolean,
): SearchState {
  const [items, setItems] = useState<MobileDealerOption[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const requestId = useRef(0);
  const lat = point?.lat;
  const lng = point?.lng;

  // Phụ thuộc giá trị đơn để gõ ghi chú ở form cha không làm tìm lại đại lý.
  useEffect(() => {
    if (!enabled) return;
    const id = ++requestId.current;
    const timer = setTimeout(
      () => {
        setLoading(true);
        const here = lat !== undefined && lng !== undefined ? { lat, lng } : null;
        void searchDealers(query, here).then((result) => {
          if (id !== requestId.current) return;
          setLoading(false);
          if (result.ok) {
            setFailed(false);
            setItems(result.items);
            setMessage(
              result.items.length === 0 ? 'Không có đại lý nào khớp trong phạm vi của bạn' : null,
            );
          } else {
            setFailed(true);
            setItems([]);
            setMessage(`${result.message}. Đang thử tìm lại.`);
          }
        });
      },
      attempt === 0 ? SEARCH_DELAY_MS : RETRY_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [query, lat, lng, enabled, attempt]);

  // Tự thử lại vài lần khi lỗi mạng; hết lượt thì chờ người dùng bấm Tìm lại.
  useEffect(() => {
    if (failed && attempt < MAX_AUTO_RETRIES) {
      setFailed(false);
      setAttempt((value) => value + 1);
    }
  }, [failed, attempt]);

  useEffect(() => {
    setAttempt(0);
  }, [query]);

  const exhausted = failed && attempt >= MAX_AUTO_RETRIES;
  return {
    items,
    message: exhausted ? 'Chưa tìm được đại lý do mất mạng.' : message,
    loading,
    failed: exhausted,
    retry: () => {
      setFailed(false);
      setAttempt(1);
    },
  };
}

type Props = {
  point: { lat: number; lng: number } | null;
  selected: DealerChoice | null;
  onSelect: (dealer: DealerChoice | null) => void;
};

/** Chọn đại lý từ danh mục khi check-in. Mất mạng thì tự tìm lại, vẫn gõ tên tay được. */
export function DealerPicker({ point, selected, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const search = useDealerSearch(query, point, selected === null);

  if (selected) {
    return (
      <View style={styles.selected}>
        <Text style={styles.selectedName}>{selected.name}</Text>
        <Pressable accessibilityRole="button" onPress={() => onSelect(null)} style={styles.change}>
          <Text style={styles.changeText}>Chọn đại lý khác</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
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
        limit={DEFAULT_VISIBLE}
        onPick={(d) => onSelect(toChoice(d))}
      />
    </View>
  );
}

/** Danh sách kết quả tìm đại lý, dùng chung cho form check-in và màn Đại lý gần tôi. */
export function DealerResults({
  search,
  limit,
  onPick,
  visitedIds,
}: {
  search: SearchState;
  limit: number;
  onPick: (dealer: MobileDealerOption) => void;
  /** Đại lý đã check-in hôm nay, hiện nhãn Đã ghé. */
  visitedIds?: ReadonlySet<string>;
}) {
  return (
    <>
      {search.loading ? <Text style={styles.muted}>Đang tìm đại lý</Text> : null}
      {search.message ? <Text style={styles.muted}>{search.message}</Text> : null}
      {search.failed ? (
        <Pressable accessibilityRole="button" onPress={search.retry} style={styles.change}>
          <Text style={styles.changeText}>Tìm lại</Text>
        </Pressable>
      ) : null}
      {search.items.slice(0, limit).map((dealer) => (
        <Pressable
          key={dealer.id}
          accessibilityRole="button"
          accessibilityLabel={`Chọn ${dealer.name}`}
          onPress={() => onPick(dealer)}
          style={({ pressed }) => [styles.option, pressed && styles.pressed]}
        >
          <View style={styles.optionHead}>
            <Text style={styles.optionName}>{dealer.name}</Text>
            <Text style={dealer.distanceM === null ? styles.muted : styles.distance}>
              {dealer.distanceM === null
                ? dealer.lat === null
                  ? 'Chưa có toạ độ'
                  : ''
                : distanceText(dealer.distanceM)}
            </Text>
          </View>
          <Text style={styles.muted} numberOfLines={1}>
            {[dealer.code ?? dealer.legacyCode, DEALER_LEVEL_LABEL[dealer.level], dealer.address]
              .filter(Boolean)
              .join(', ')}
          </Text>
          {visitedIds?.has(dealer.id) ? <Text style={styles.visited}>Đã ghé hôm nay</Text> : null}
        </Pressable>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SPACE.xs },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: SPACE.md,
    fontSize: 16,
    color: COLORS.text,
  },
  option: {
    minHeight: 48,
    paddingVertical: SPACE.sm,
    paddingHorizontal: SPACE.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  pressed: { backgroundColor: COLORS.brandSoft },
  optionHead: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACE.sm },
  visited: { fontSize: 13, fontWeight: FONT.bold, color: COLORS.brand },
  optionName: { flex: 1, fontSize: 15, fontWeight: FONT.bold, color: COLORS.text },
  distance: { fontSize: 15, fontWeight: FONT.bold, color: COLORS.brand },
  muted: { fontSize: 13, color: COLORS.textMuted },
  selected: {
    borderWidth: 1,
    borderColor: COLORS.brand,
    borderRadius: 8,
    padding: SPACE.md,
    gap: SPACE.xs,
    backgroundColor: COLORS.brandSoft,
  },
  selectedName: { fontSize: 16, fontWeight: FONT.bold, color: COLORS.text },
  change: { minHeight: 44, justifyContent: 'center' },
  changeText: { fontSize: 15, color: COLORS.brand, fontWeight: FONT.bold },
});
