import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { LOCATION_CONSENT } from '@seedgw/contracts/consents';
import { COLORS, FONT, SPACE } from '../theme';
import { Button } from './button';
import { Text } from './text';

type Props = {
  onAccept: () => void;
  onLogout: (() => void) | null;
};

/**
 * Lời đồng ý chia sẻ vị trí, hiện trước khi dùng check-in (17/11/2026). Không đồng ý thì không check-in
 * được, có nút xem lại để đồng ý sau.
 */
export function ConsentScreen({ onAccept, onLogout }: Props) {
  const [declined, setDeclined] = useState(false);

  if (declined) {
    return (
      <View style={[styles.fill, styles.center]}>
        <Text style={styles.title}>Chưa check-in được</Text>
        <Text style={styles.body}>
          Bạn chưa đồng ý chia sẻ vị trí nên chưa check-in được trên app. Liên hệ quản lý để được
          ghi nhận theo cách khác, hoặc xem lại lời đồng ý.
        </Text>
        <Button label="Xem lại lời đồng ý" onPress={() => setDeclined(false)} />
        {onLogout ? <Button label="Đăng xuất" onPress={onLogout} variant="ghost" /> : null}
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{LOCATION_CONSENT.title}</Text>
        <Text style={styles.body}>{LOCATION_CONSENT.intro}</Text>
        {LOCATION_CONSENT.sections.map((section) => (
          <View key={section.heading} style={styles.section}>
            <Text style={styles.heading}>{section.heading}</Text>
            {section.items.map((item) => (
              <View key={item} style={styles.item}>
                <View style={styles.bullet} />
                <Text style={styles.itemText}>{item}</Text>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
      <View style={styles.controls}>
        <Button
          label={LOCATION_CONSENT.declineLabel}
          onPress={() => setDeclined(true)}
          variant="ghost"
        />
        <Button label={LOCATION_CONSENT.acceptLabel} onPress={onAccept} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: COLORS.surface },
  center: { justifyContent: 'center', padding: SPACE.xl, gap: SPACE.md },
  content: { padding: SPACE.lg, gap: SPACE.md },
  title: { fontSize: 20, fontWeight: FONT.bold, color: COLORS.brand },
  body: { fontSize: 15, lineHeight: 22, color: COLORS.text },
  section: { gap: SPACE.xs },
  heading: { fontSize: 16, fontWeight: FONT.bold, color: COLORS.brand },
  item: { flexDirection: 'row', gap: SPACE.sm, alignItems: 'flex-start' },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.brand,
    marginTop: 8,
  },
  itemText: { flex: 1, fontSize: 15, lineHeight: 22, color: COLORS.text },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACE.md,
    padding: SPACE.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
});
