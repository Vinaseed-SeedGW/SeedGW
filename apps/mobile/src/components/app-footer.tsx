import { StyleSheet, Text, View } from 'react-native';
import { FOOTER } from '@dms/config/footer';
import { COLORS, SPACE } from '../theme';

// Chân trang theo BRAND.md: app đặt ở cuối màn Tôi (ở bản thử là cuối màn hành trình).
export function AppFooter() {
  return (
    <View style={styles.footer}>
      <Text style={styles.text}>
        Bản quyền <Text style={styles.copyright}>©</Text> {FOOTER.year} thuộc {FOOTER.department}
      </Text>
      <Text style={styles.text}>
        Liên hệ {FOOTER.department}: {FOOTER.email}, SĐT {FOOTER.phone}
      </Text>
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
