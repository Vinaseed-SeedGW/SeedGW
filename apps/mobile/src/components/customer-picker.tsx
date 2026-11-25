import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { CUSTOMER_KIND_LABEL, type MobileCustomerOption } from '@seedgw/contracts/customers';
import { searchCustomers, type CustomerChoice } from '../api/customers';
import { COLORS, FONT, SPACE } from '../theme';
import { distanceText } from './dealer-picker';
import { Text, TextInput } from './text';

const SEARCH_DELAY_MS = 350;
const VISIBLE = 8;
const RETRY_DELAY_MS = 5_000;
const MAX_AUTO_RETRIES = 6;

type Props = {
  point: { lat: number; lng: number } | null;
  selected: CustomerChoice | null;
  onSelect: (customer: CustomerChoice | null) => void;
};

/** S1: chọn khách hàng khi check-in. Mất mạng thì tự tìm lại, vẫn gõ tên tay được. */
export function CustomerPicker({ point, selected, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<MobileCustomerOption[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const requestId = useRef(0);
  const lat = point?.lat;
  const lng = point?.lng;
  const enabled = selected === null;

  useEffect(() => {
    if (!enabled) return;
    const id = ++requestId.current;
    const timer = setTimeout(
      () => {
        setLoading(true);
        const here = lat !== undefined && lng !== undefined ? { lat, lng } : null;
        void searchCustomers(query, here).then((result) => {
          if (id !== requestId.current) return;
          setLoading(false);
          if (result.ok) {
            setItems(result.items);
            setMessage(
              result.items.length === 0
                ? 'Không có khách hàng nào khớp trong phạm vi của bạn. Gõ tên khách hàng bên dưới.'
                : null,
            );
            return;
          }
          setItems([]);
          if (attempt < MAX_AUTO_RETRIES) {
            setMessage(`${result.message}. Đang thử tìm lại.`);
            setAttempt((value) => value + 1);
          } else {
            setMessage('Chưa tìm được khách hàng do mất mạng. Gõ tên khách hàng bên dưới.');
          }
        });
      },
      attempt === 0 ? SEARCH_DELAY_MS : RETRY_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [query, lat, lng, enabled, attempt]);

  useEffect(() => {
    setAttempt(0);
  }, [query]);

  if (selected) {
    return (
      <View style={styles.selected}>
        <Text style={styles.selectedName}>{selected.name}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => onSelect(null)}
          style={({ pressed }) => [styles.change, pressed && styles.pressedText]}
        >
          <Text style={styles.changeText}>Chọn khách hàng khác</Text>
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
        accessibilityLabel="Tìm khách hàng"
        style={styles.input}
        autoCorrect={false}
      />
      {loading ? <Text style={styles.muted}>Đang tìm khách hàng</Text> : null}
      {message ? <Text style={styles.muted}>{message}</Text> : null}
      {items.slice(0, VISIBLE).map((customer) => (
        <Pressable
          key={customer.id}
          accessibilityRole="button"
          accessibilityLabel={`Chọn ${customer.name}`}
          onPress={() => onSelect({ id: customer.id, name: customer.name })}
          style={({ pressed }) => [styles.option, pressed && styles.pressed]}
        >
          <View style={styles.optionHead}>
            <Text style={styles.optionName}>{customer.name}</Text>
            {customer.distanceM !== null ? (
              <Text style={styles.distance}>{distanceText(customer.distanceM)}</Text>
            ) : null}
          </View>
          <Text style={styles.muted} numberOfLines={1}>
            {[customer.code, CUSTOMER_KIND_LABEL[customer.kind], customer.phone, customer.address]
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
  pressedText: { opacity: 0.7 },
  optionHead: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACE.sm },
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
