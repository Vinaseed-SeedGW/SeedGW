import * as Updates from 'expo-updates';
import { StyleSheet, Text, View } from 'react-native';
import { FOOTER } from '@dms/config/footer';
import { COLORS, SPACE } from '../theme';

// Chân trang theo BRAND.md: app đặt ở cuối màn Tôi (ở bản thử là cuối màn hành trình).
// Ghi kèm mã bản cập nhật để khi báo lỗi biết máy đang chạy bản nào.
function versionLabel(): string {
  const runtime = Updates.runtimeVersion ?? 'chạy thử';
  return Updates.updateId ? `${runtime}, cập nhật ${Updates.updateId.slice(0, 8)}` : runtime;
}

export function AppFooter() {
  return (
    <View style={styles.footer}>
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
  text: { fontSize: 12, color: COLORS.textMuted },
  copyright: { fontSize: 15 },
});
