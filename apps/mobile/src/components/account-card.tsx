import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Text } from './text';
import type { MobileProfile } from '@dms/contracts/check-ins';
import { logout } from '../api/client';
import { COLORS, FONT, SPACE } from '../theme';
import { Button } from './button';
import type { SyncControl } from './use-sync';

type Props = {
  user: MobileProfile;
  sync: SyncControl;
  onBeforeLogout: () => Promise<void>;
  onWithdrawConsent: () => void;
};

/** Tài khoản và tình trạng gửi dữ liệu. Còn check-in chưa gửi thì không cho đăng xuất (M3). */
export function AccountCard({ user, sync, onBeforeLogout, onWithdrawConsent }: Props) {
  const { pending, syncing, lastError } = sync.state;

  function confirmLogout() {
    if (pending.checkIns > 0 || pending.points > 0) {
      Alert.alert(
        'Chưa đăng xuất được',
        'Còn dữ liệu chưa gửi lên máy chủ. Bật mạng và bấm Gửi ngay, gửi xong mới đăng xuất được.',
      );
      return;
    }
    Alert.alert('Đăng xuất', 'Đăng xuất khỏi app trên máy này? App sẽ dừng ghi hành trình.', [
      { text: 'Không', style: 'cancel' },
      {
        text: 'Đăng xuất',
        style: 'destructive',
        onPress: () => {
          void onBeforeLogout().then(logout);
        },
      },
    ]);
  }

  const waiting =
    pending.checkIns === 0 && pending.points === 0
      ? 'Đã gửi hết lên máy chủ'
      : `Chờ gửi: ${pending.checkIns} check-in, ${pending.points} điểm GPS`;

  return (
    <View style={styles.card}>
      <Text style={styles.name}>{user.fullName}</Text>
      <Text style={styles.muted}>
        {user.employeeCode}
        {user.orgUnitName ? `, ${user.orgUnitName}` : ''}
      </Text>
      <Text style={styles.status}>{syncing ? 'Đang gửi lên máy chủ' : waiting}</Text>
      {pending.failedCheckIns > 0 ? (
        <Text style={styles.error}>
          {pending.failedCheckIns} check-in máy chủ không nhận. Báo Phòng ĐMST&CĐS để kiểm tra.
        </Text>
      ) : null}
      {lastError ? <Text style={styles.muted}>Lần gửi gần nhất: {lastError}</Text> : null}
      <View style={styles.actions}>
        <Button label="Gửi ngay" onPress={() => void sync.actions.syncNow()} variant="ghost" />
        <Button label="Đăng xuất" onPress={confirmLogout} variant="ghost" />
      </View>
      <Pressable accessibilityRole="button" onPress={onWithdrawConsent} style={styles.link}>
        <Text style={styles.linkText}>Rút lại đồng ý chia sẻ vị trí</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: SPACE.md,
    gap: SPACE.xs,
  },
  name: { fontSize: 17, fontWeight: FONT.bold, color: COLORS.text },
  muted: { fontSize: 14, color: COLORS.textMuted },
  status: { fontSize: 15, color: COLORS.text, marginTop: SPACE.xs },
  error: { fontSize: 14, color: COLORS.danger },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm, marginTop: SPACE.sm },
  link: { minHeight: 44, justifyContent: 'center' },
  linkText: { fontSize: 14, color: COLORS.textMuted },
});
