import * as Updates from 'expo-updates';
import { Image, StyleSheet, View } from 'react-native';
import logoColor from '../../assets/images/logo-color-s.png';
import { Text } from './text';
import { FOOTER } from '@dms/config/footer';
import { COLORS, SPACE } from '../theme';

// Chân trang theo BRAND.md: app đặt ở cuối màn Tôi (ở bản thử là cuối màn hành trình).
// Ghi kèm mã bản cập nhật để khi báo lỗi biết máy đang chạy bản nào.
function versionLabel(): string {
  const runtime = Updates.runtimeVersion ?? 'chạy thử';
  return Updates.updateId ? `${runtime}, cập nhật ${Updates.updateId.slice(0, 8)}` : runtime;
}

// Logo cỡ S rộng 120 px, chiều cao theo tỉ lệ gốc của logo.
const LOGO_WIDTH = 120;
const LOGO_HEIGHT = Math.round((LOGO_WIDTH * 307.09) / 1222.02);

export function AppFooter() {
  return (
    <View style={styles.footer}>
      <Image
        source={logoColor}
        style={[styles.logo, { width: LOGO_WIDTH, height: LOGO_HEIGHT }]}
        accessibilityLabel="Vinaseed"
        resizeMode="contain"
      />
      <Text style={styles.text}>
        Bản quyền <Text style={styles.copyright}>©</Text> {FOOTER.year} thuộc {FOOTER.department}
      </Text>
      <Text style={styles.text}>
        Liên hệ {FOOTER.department}: {FOOTER.email}, SĐT {FOOTER.phone}
      </Text>
      <Text style={styles.text}>Phiên bản: {versionLabel()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    marginTop: SPACE.xl,
    paddingTop: SPACE.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
    gap: SPACE.xs,
  },
  // Vùng an toàn quanh logo bằng 1/18 chiều rộng (BRAND.md §1).
  logo: { margin: Math.ceil(LOGO_WIDTH / 18), marginLeft: 0 },
  text: { fontSize: 12, color: COLORS.textMuted },
  copyright: { fontSize: 15 },
});
