import { Pressable, StyleSheet, View } from 'react-native';
import { COLORS, FONT, FONT_SCALE, SPACE } from '../theme';
import { Text } from './text';

/**
 * Nút nổi Hỗ trợ ở góc dưới bên phải, ngay trên thanh tab, có ở cả 4 tab (quyết định 32).
 * Biểu tượng phao cứu sinh vẽ bằng khung tròn, không cần thêm thư viện biểu tượng.
 */
export function SupportFab({ count, onPress }: { count: number; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={count > 0 ? `Hỗ trợ, ${count} mục mới` : 'Hỗ trợ'}
      onPress={onPress}
      style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
    >
      <View style={styles.ring}>
        <View style={styles.hole} />
      </View>
      <Text style={styles.label} maxFontSizeMultiplier={FONT_SCALE.compact}>
        Hỗ trợ
      </Text>
      {count > 0 ? (
        <Text style={styles.badge} maxFontSizeMultiplier={FONT_SCALE.badge}>
          {count > 99 ? '99+' : String(count)}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: SPACE.lg,
    bottom: SPACE.lg,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    paddingHorizontal: SPACE.lg,
    borderRadius: 24,
    backgroundColor: COLORS.brand,
    // Bóng nhẹ để nút nổi tách khỏi nội dung phía dưới.
    shadowColor: COLORS.text,
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  pressed: { backgroundColor: COLORS.brandDark },
  ring: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 5,
    borderColor: COLORS.onBrand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hole: { width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.brand },
  label: { color: COLORS.onBrand, fontSize: 15, fontWeight: FONT.bold },
  badge: {
    position: 'absolute',
    top: -6,
    right: -4,
    minWidth: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: COLORS.danger,
    color: COLORS.onBrand,
    fontSize: 12,
    fontWeight: FONT.bold,
    textAlign: 'center',
  },
});

/** Khoảng trống cuối mỗi tab để nút nổi không che nút bấm cuối cùng. */
export const SUPPORT_FAB_CLEARANCE = 88;
