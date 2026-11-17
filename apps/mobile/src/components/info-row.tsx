import { StyleSheet, View } from 'react-native';
import { COLORS, SPACE } from '../theme';
import { Text } from './text';

/** Một dòng nhãn và giá trị trong thẻ thông tin. */
export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

export const cardStyle = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: SPACE.md,
  },
}).card;

const styles = StyleSheet.create({
  row: {
    paddingVertical: SPACE.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  label: { fontSize: 13, color: COLORS.textMuted },
  value: { fontSize: 15, color: COLORS.text, marginTop: 2 },
});
