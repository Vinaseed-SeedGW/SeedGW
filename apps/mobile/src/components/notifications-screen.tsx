import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  NOTIFICATION_KIND_LABEL,
  type MobileNotificationItem,
} from '@seedgw/contracts/notifications';
import type { PushTarget } from '@seedgw/contracts/push';
import { loadNotifications, markNotificationsRead } from '../api/notifications';
import { formatVnDate, formatVnTime } from '../sync/geo';
import { COLORS, FONT, SPACE } from '../theme';
import { BackBar } from './back-bar';
import { Button } from './button';
import { Text } from './text';

type Props = {
  onClose: () => void;
  /** Mở màn tương ứng như khi bấm thông báo đẩy. */
  onOpenTarget: (target: PushTarget) => void;
};

function when(iso: string): string {
  const at = Date.parse(iso);
  return `${formatVnTime(at).slice(0, 5)} ${formatVnDate(at)}`;
}

/** D4: thông báo đã nhận trên app, cùng dữ liệu với trang Thông báo trên web. */
export function NotificationsScreen({ onClose, onOpenTarget }: Props) {
  const [items, setItems] = useState<MobileNotificationItem[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const result = await loadNotifications();
    if (result.ok) {
      setItems(result.page.items);
      setUnread(result.page.unread);
      setError(null);
    } else {
      setError(`${result.message}. Kéo xuống hoặc bấm Tải lại khi có mạng.`);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function open(item: MobileNotificationItem) {
    if (!item.read) void markNotificationsRead({ ids: [item.id] });
    if (item.target) onOpenTarget(item.target);
    else void reload();
  }

  async function markAll() {
    if (busy) return;
    setBusy(true);
    await markNotificationsRead({ all: true });
    await reload();
    setBusy(false);
  }

  return (
    <View style={styles.fill}>
      <BackBar title="Thông báo" onBack={onClose} />
      <ScrollView contentContainerStyle={styles.content}>
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.error}>{error}</Text>
            <Button label="Tải lại" onPress={() => void reload()} variant="ghost" />
          </View>
        ) : null}
        {items === null && !error ? <ActivityIndicator color={COLORS.brand} /> : null}
        {items && unread > 0 ? (
          <View style={styles.actions}>
            <Button label="Đánh dấu tất cả đã đọc" onPress={() => void markAll()} variant="ghost" />
          </View>
        ) : null}
        {items && items.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Chưa có thông báo nào</Text>
            <Text style={styles.muted}>
              Kết quả duyệt tuyến, toạ độ, đại lý mới và trả lời hỗ trợ sẽ hiện ở đây.
            </Text>
          </View>
        ) : null}
        {items?.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={`${item.title}${item.read ? '' : ', chưa đọc'}`}
            onPress={() => void open(item)}
            style={({ pressed }) => [
              styles.card,
              !item.read && styles.unread,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.head}>
              <Text style={styles.kind}>{NOTIFICATION_KIND_LABEL[item.kind]}</Text>
              <Text style={styles.muted}>{when(item.createdAt)}</Text>
            </View>
            <Text style={[styles.title, !item.read && styles.titleUnread]}>{item.title}</Text>
            <Text style={styles.body}>{item.body}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: COLORS.surfaceSubtle },
  content: { padding: SPACE.lg, gap: SPACE.md },
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
  card: {
    minHeight: 48,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACE.lg,
    gap: SPACE.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  unread: { borderLeftWidth: 4, borderLeftColor: COLORS.brand },
  pressed: { backgroundColor: COLORS.brandSoft },
  head: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACE.sm },
  kind: { fontSize: 13, fontWeight: FONT.bold, color: COLORS.brand },
  title: { fontSize: 16, color: COLORS.text },
  titleUnread: { fontWeight: FONT.bold },
  body: { fontSize: 15, color: COLORS.textMuted },
  muted: { fontSize: 13, color: COLORS.textMuted },
  empty: { alignItems: 'center', gap: SPACE.sm, paddingVertical: SPACE.xl },
  emptyTitle: { fontSize: 16, fontWeight: FONT.bold, color: COLORS.text },
  errorBox: { gap: SPACE.sm },
  error: { fontSize: 15, color: COLORS.danger },
});
