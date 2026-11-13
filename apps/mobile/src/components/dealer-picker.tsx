import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { DEALER_LEVEL_LABEL, type MobileDealerOption } from '@dms/contracts/dealers';
import { searchDealers } from '../api/dealers';
import { COLORS, FONT, SPACE } from '../theme';

const SEARCH_DELAY_MS = 350;
const VISIBLE_RESULTS = 8;

type Props = {
  point: { lat: number; lng: number } | null;
  selected: { id: string; name: string } | null;
  onSelect: (dealer: { id: string; name: string } | null) => void;
};

function distanceText(meters: number | null): string {
  if (meters === null) return '';
  return meters < 1000 ? `${meters} m` : `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}

/** Chọn đại lý từ danh mục khi check-in. Mất mạng thì báo, nhân viên vẫn gõ tên tay được. */
export function DealerPicker({ point, selected, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<MobileDealerOption[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);
  const lat = point?.lat;
  const lng = point?.lng;
  const selectedId = selected?.id ?? null;

  // Phụ thuộc giá trị đơn để gõ ghi chú ở form cha không làm tìm lại đại lý.
  useEffect(() => {
    if (selectedId) return;
    const id = ++requestId.current;
    const timer = setTimeout(() => {
      setLoading(true);
      const here = lat !== undefined && lng !== undefined ? { lat, lng } : null;
      void searchDealers(query, here).then((result) => {
        if (id !== requestId.current) return;
        setLoading(false);
        if (result.ok) {
          setItems(result.items);
          setMessage(
            result.items.length === 0 ? 'Không có đại lý nào khớp trong phạm vi của bạn' : null,
          );
        } else {
          setItems([]);
          setMessage(`${result.message}. Gõ tên đại lý ở ô dưới.`);
        }
      });
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [query, lat, lng, selectedId]);

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
      {loading ? <Text style={styles.muted}>Đang tìm đại lý</Text> : null}
      {message ? <Text style={styles.muted}>{message}</Text> : null}
      {items.slice(0, VISIBLE_RESULTS).map((dealer) => (
        <Pressable
          key={dealer.id}
          accessibilityRole="button"
          accessibilityLabel={`Chọn ${dealer.name}`}
          onPress={() => onSelect({ id: dealer.id, name: dealer.name })}
          style={({ pressed }) => [styles.option, pressed && styles.pressed]}
        >
          <Text style={styles.optionName}>
            {dealer.name}
            {dealer.distanceM !== null ? `   ${distanceText(dealer.distanceM)}` : ''}
          </Text>
          <Text style={styles.muted} numberOfLines={1}>
            {[dealer.code ?? dealer.legacyCode, DEALER_LEVEL_LABEL[dealer.level], dealer.address]
              .filter(Boolean)
              .join(', ')}
          </Text>
        </Pressable>
      ))}
    </View>
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
  optionName: { fontSize: 15, fontWeight: FONT.bold, color: COLORS.text },
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
