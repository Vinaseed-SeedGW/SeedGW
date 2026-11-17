import { Image, StyleSheet, View } from 'react-native';
import logoWhite from '../../assets/images/logo-white-m.png';
import { COLORS, SPACE } from '../theme';
import { Text } from './text';

// Logo cỡ M rộng 160 px; ảnh gốc 480 px nên chiều cao giữ đúng tỉ lệ của logo.
const LOGO_WIDTH = 160;
const LOGO_HEIGHT = Math.round((LOGO_WIDTH * 307.09) / 1222.02);
// Vùng an toàn bằng 1/18 chiều rộng logo (BRAND.md §1).
const SAFE_AREA = Math.ceil(LOGO_WIDTH / 18);

/** Thanh tiêu đề xanh với logo trắng cỡ M (BRAND.md §4), tên tab đang mở ở bên phải. */
export function AppHeader({ title }: { title: string }) {
  return (
    <View style={styles.bar}>
      <View style={styles.logoBox}>
        <Image
          source={logoWhite}
          style={{ width: LOGO_WIDTH, height: LOGO_HEIGHT }}
          accessibilityLabel="Vinaseed"
          resizeMode="contain"
        />
      </View>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: COLORS.brand,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.xs,
    gap: SPACE.md,
  },
  logoBox: { padding: SAFE_AREA },
  title: { flexShrink: 1, fontSize: 16, color: COLORS.onBrand },
});
