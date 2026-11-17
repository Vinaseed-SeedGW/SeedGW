import { Pressable, StyleSheet, View } from 'react-native';
import { COLORS, FONT, SPACE } from '../theme';
import { Text } from './text';

/** Dòng Quay lại dưới thanh tiêu đề cho màn mở chồng lên tab. */
export function BackBar({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.bar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Quay lại"
        onPress={onBack}
        style={styles.back}
      >
        <Text style={styles.backText}>Quay lại</Text>
      </Pressable>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    paddingHorizontal: SPACE.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  back: { minHeight: 44, justifyContent: 'center' },
  backText: { fontSize: 15, color: COLORS.brand, fontWeight: FONT.bold },
  title: { flex: 1, fontSize: 16, fontWeight: FONT.bold, color: COLORS.text },
});
