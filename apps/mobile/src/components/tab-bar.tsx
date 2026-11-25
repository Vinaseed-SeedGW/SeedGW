import { Image, Pressable, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import tabHistory from '../../assets/images/tab-history.png';
import tabMe from '../../assets/images/tab-me.png';
import tabToday from '../../assets/images/tab-today.png';
import { COLORS, FONT, FONT_SCALE, SPACE } from '../theme';
import { Text } from './text';

// App tinh gọn (25/11/2026): 3 tab, tuyến hôm nay và Đại lý gần tôi nằm trong tab Hôm nay.
export type TabKey = 'today' | 'history' | 'me';

export const TABS: { key: TabKey; label: string; icon: ImageSourcePropType }[] = [
  { key: 'today', label: 'Hôm nay', icon: tabToday },
  { key: 'history', label: 'Lịch sử', icon: tabHistory },
  { key: 'me', label: 'Tôi', icon: tabMe },
];

/** 3 tab ở đáy màn hình. Icon vẽ màu đen, tô lại theo tab đang chọn. */
/** Số đỏ trên tab, ví dụ tab Tôi khi có trả lời Hỗ trợ chưa đọc (T3). */
export type TabBadges = Partial<Record<TabKey, number>>;

export function TabBar({
  active,
  onChange,
  badges,
}: {
  active: TabKey;
  onChange: (tab: TabKey) => void;
  badges: TabBadges;
}) {
  return (
    <View style={styles.bar} accessibilityRole="tablist">
      {TABS.map((tab) => {
        const selected = tab.key === active;
        const color = selected ? COLORS.brand : COLORS.textMuted;
        const badge = badges[tab.key] ?? 0;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={badge > 0 ? `${tab.label}, ${badge} mới` : tab.label}
            onPress={() => onChange(tab.key)}
            style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
          >
            <View>
              <Image source={tab.icon} style={[styles.icon, { tintColor: color }]} />
              {badge > 0 ? (
                <Text style={styles.badge} maxFontSizeMultiplier={FONT_SCALE.badge}>
                  {badge > 9 ? '9+' : String(badge)}
                </Text>
              ) : null}
            </View>
            <Text
              style={[styles.label, { color }, selected && styles.labelSelected]}
              maxFontSizeMultiplier={FONT_SCALE.compact}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  tab: {
    flex: 1,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: SPACE.xs,
  },
  pressed: { backgroundColor: COLORS.brandSoft },
  icon: { width: 24, height: 24 },
  label: { fontSize: 12 },
  labelSelected: { fontWeight: FONT.bold },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    overflow: 'hidden',
    backgroundColor: COLORS.danger,
    color: COLORS.onBrand,
    fontSize: 11,
    fontWeight: FONT.bold,
    textAlign: 'center',
  },
});
