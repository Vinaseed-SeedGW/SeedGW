import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { MobileProfile } from '@seedgw/contracts/check-ins';
import { FILTER } from '@seedgw/contracts/track-distance';
import { logout } from '../api/client';
import { TRACKING_CONFIG } from '../sync/background-tracking';
import { formatKm, formatVnTime, startOfVnDay } from '../sync/geo';
import {
  clearAllTestData,
  computeDayStats,
  countTaskErrorsSince,
  getTrackingSettings,
  getTesterProfile,
  saveTesterProfile,
  type TesterProfile,
} from '../sync/track-db';
import { COLORS, FONT, SPACE } from '../theme';
import { SUPPORT_FAB_CLEARANCE } from './support-fab';
import { AppFooter } from './app-footer';
import { Button } from './button';
import { cardStyle, InfoRow } from './info-row';
import { Text, TextInput } from './text';
import type { SyncControl } from './use-sync';
import type { TrackingControl } from './use-tracking';
import { getPushRegistrationError, type PushState } from '../sync/push';

const PERMISSION_LABEL = {
  ALWAYS: 'Luôn cho phép',
  WHEN_IN_USE: 'Chỉ khi dùng app (vết sẽ đứt khi tắt màn hình)',
  DENIED: 'Chưa cho phép',
} as const;

type Props = {
  control: TrackingControl;
  /** Có khi app nối máy chủ và đã đăng nhập. Null là bản thử, dữ liệu chỉ trên máy. */
  account: { user: MobileProfile; sync: SyncControl } | null;
  onWithdrawConsent: () => void;
  /** Sổ đồng ý, giấy xác nhận (25/11/2026); null ở bản thử chưa nối máy chủ. */
  onOpenConsents: (() => void) | null;
  /** Quản lý và Lãnh đạo đơn vị có mục Cần duyệt (A10b). */
  approvals: { pendingCount: number; onOpen: () => void } | null;
  /** Màn hình Hỗ trợ (T3); null ở bản thử chưa nối máy chủ. */
  support: { unreadCount: number; pendingCount: number; onOpen: () => void } | null;
  /** Trạng thái thông báo đẩy (M7); null ở bản thử chưa nối máy chủ. */
  notifications: { state: PushState | null; onRefresh: () => void } | null;
};

const PUSH_LABEL: Record<PushState, string> = {
  GRANTED: 'Đang bật',
  DENIED:
    'Đang tắt. Bật trong Cài đặt của điện thoại để nhận trả lời Hỗ trợ, tuyến được duyệt, nhắc check-in.',
  UNDETERMINED: 'Chưa bật',
  UNSUPPORTED: 'Bản app đang cài chưa có thông báo, cần cài bản mới.',
};

/** Tab Tôi (IA): thông tin, Hỗ trợ, quyền vị trí, rút lại đồng ý, đăng xuất, thông tin kỹ thuật, chân trang. */
export function MeTab({
  control,
  account,
  onWithdrawConsent,
  onOpenConsents,
  approvals,
  support,
  notifications,
}: Props) {
  const { state, actions } = control;
  const [showTech, setShowTech] = useState(false);

  function confirmLogout() {
    if (!account) return;
    const { pending } = account.sync.state;
    if (pending.checkIns > 0 || pending.points > 0) {
      Alert.alert(
        'Chưa đăng xuất được',
        'Còn dữ liệu chưa gửi lên máy chủ. Bật mạng và bấm Gửi ngay ở tab Hôm nay, gửi xong mới đăng xuất được.',
      );
      return;
    }
    Alert.alert('Đăng xuất', 'Đăng xuất khỏi app trên máy này? App sẽ dừng ghi hành trình.', [
      { text: 'Không', style: 'cancel' },
      {
        text: 'Đăng xuất',
        style: 'destructive',
        onPress: () => {
          void actions.stop().then(logout);
        },
      },
    ]);
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.card}>
        {account ? (
          <>
            <Text style={styles.name}>{account.user.fullName}</Text>
            <Text style={styles.muted}>
              {account.user.employeeCode}
              {account.user.orgUnitName ? `, ${account.user.orgUnitName}` : ''}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.name}>Bản thử, chưa đăng nhập</Text>
            <Text style={styles.muted}>Dữ liệu chỉ nằm trên máy này.</Text>
          </>
        )}
      </View>

      {approvals ? (
        <View style={styles.card}>
          <Text style={styles.section}>Cần duyệt</Text>
          <Text style={styles.body}>
            {approvals.pendingCount > 0
              ? `${approvals.pendingCount} phiếu đang chờ bạn duyệt`
              : 'Không có phiếu nào chờ bạn duyệt'}
          </Text>
          <View style={styles.actions}>
            <Button label="Mở Cần duyệt" onPress={approvals.onOpen} variant="ghost" />
          </View>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.section}>Hỗ trợ</Text>
        {support ? (
          <>
            <Text style={styles.body}>
              {support.unreadCount > 0
                ? `${support.unreadCount} yêu cầu có trả lời mới`
                : 'Hỏi đáp, báo lỗi, góp ý gửi tới Quản trị đơn vị của bạn.'}
            </Text>
            {support.pendingCount > 0 ? (
              <Text style={styles.muted}>
                {support.pendingCount} mục đang chờ gửi, có mạng app tự gửi.
              </Text>
            ) : null}
            <View style={styles.actions}>
              <Button label="Mở Hỗ trợ" onPress={support.onOpen} variant="ghost" />
            </View>
          </>
        ) : (
          <Text style={styles.body}>
            Bản thử chưa nối máy chủ: gặp vướng mắc thì liên hệ Phòng ĐMST&CĐS theo email hoặc số
            điện thoại ở cuối trang.
          </Text>
        )}
      </View>

      {notifications ? (
        <View style={styles.card}>
          <Text style={styles.section}>Thông báo</Text>
          {notifications.state ? (
            <Text style={styles.body}>{PUSH_LABEL[notifications.state]}</Text>
          ) : null}
          {notifications.state === 'GRANTED' && getPushRegistrationError() ? (
            <Text style={styles.muted}>{getPushRegistrationError()}</Text>
          ) : null}
          {notifications.state === 'DENIED' ? (
            <View style={styles.actions}>
              <Button
                label="Mở Cài đặt"
                onPress={() => void Linking.openSettings().then(notifications.onRefresh)}
                variant="ghost"
              />
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.section}>Quyền vị trí</Text>
        <Text style={styles.body}>{PERMISSION_LABEL[state.permission]}</Text>
        {state.permission === 'ALWAYS' ? null : (
          <Text style={styles.muted}>
            Chọn Luôn luôn để app ghi được hành trình khi tắt màn hình.
          </Text>
        )}
        <View style={styles.actions}>
          <Button label="Mở Cài đặt" onPress={() => void Linking.openSettings()} variant="ghost" />
        </View>
      </View>

      {account ? (
        <View style={styles.actions}>
          <Button label="Đăng xuất" onPress={confirmLogout} variant="ghost" />
        </View>
      ) : (
        <ProfileForm />
      )}
      {onOpenConsents ? (
        <Pressable accessibilityRole="button" onPress={onOpenConsents} style={styles.link}>
          <Text style={styles.linkText}>Đồng ý của tôi, giấy xác nhận</Text>
        </Pressable>
      ) : null}
      <Pressable accessibilityRole="button" onPress={onWithdrawConsent} style={styles.link}>
        <Text style={styles.linkText}>Rút lại đồng ý chia sẻ vị trí</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: showTech }}
        onPress={() => setShowTech((value) => !value)}
        style={styles.link}
      >
        <Text style={styles.linkText}>
          {showTech ? 'Ẩn thông tin kỹ thuật' : 'Thông tin kỹ thuật (dùng khi báo lỗi)'}
        </Text>
      </Pressable>
      {showTech ? <TechInfo /> : null}
      {account ? null : <ClearTestData />}

      <AppFooter />
    </ScrollView>
  );
}

function TechInfo() {
  const tracking = getTrackingSettings();
  const dayStart = startOfVnDay(Date.now());
  const stats = computeDayStats(dayStart);
  return (
    <View style={cardStyle}>
      <InfoRow
        label="Điểm GPS hôm nay"
        value={`${stats.pointCount}, trong đó ${stats.backgroundCount} điểm khi app ở nền`}
      />
      <InfoRow
        label="Điểm gần nhất"
        value={
          stats.lastPoint
            ? `${formatVnTime(stats.lastPoint.recordedAt)}, sai số ${Math.round(stats.lastPoint.accuracy ?? 0)} m`
            : 'Chưa có'
        }
      />
      <InfoRow label="Km theo GPS (đã lọc)" value={`${formatKm(stats.gpsDistanceM)} km`} />
      <InfoRow
        label={`Chỗ đứng yên đã gộp (từ ${tracking.stopMinSeconds} giây trong ${tracking.stopRadiusM} m)`}
        value={String(stats.stopCount)}
      />
      <InfoRow
        label={`Điểm sai số trên ${tracking.maxAccuracyM} m`}
        value={String(stats.poorAccuracyCount)}
      />
      <InfoRow label="Điểm từ ứng dụng giả lập vị trí" value={String(stats.mockedCount)} />
      <InfoRow
        label={`Đoạn đứt (quá ${FILTER.gapMinutes} phút và quá ${FILTER.gapMeters} m)`}
        value={
          stats.gapCount > 0
            ? `${stats.gapCount}, dài nhất ${Math.round(stats.longestGapMinutes)} phút`
            : 'Không có'
        }
      />
      <InfoRow label="Lỗi khi chạy nền" value={String(countTaskErrorsSince(dayStart))} />
      <InfoRow
        label="Cách ghi"
        value={`${tracking.intervalSeconds} giây một lần, khi đã đi thêm ${TRACKING_CONFIG.distanceIntervalM} m. Tự dừng lúc ${tracking.autoStopHourVn}:00.`}
      />
    </View>
  );
}

const PROFILE_FIELDS: { key: keyof TesterProfile; label: string }[] = [
  { key: 'employeeName', label: 'Tên nhân viên' },
  { key: 'employeeCode', label: 'Mã nhân viên' },
  { key: 'orgUnitName', label: 'Tên đơn vị' },
];

/** Bản thử chưa đăng nhập, người thử tự điền một lần để file Excel có đủ cột nhân viên. */
function ProfileForm() {
  const [profile, setProfile] = useState<TesterProfile>(getTesterProfile);
  return (
    <View style={cardStyle}>
      {PROFILE_FIELDS.map((field) => (
        <View key={field.key} style={styles.field}>
          <Text style={styles.muted}>{field.label}</Text>
          <TextInput
            value={profile[field.key]}
            onChangeText={(value) => setProfile((current) => ({ ...current, [field.key]: value }))}
            onEndEditing={() => saveTesterProfile(profile)}
            accessibilityLabel={field.label}
            autoCapitalize={field.key === 'employeeCode' ? 'none' : 'words'}
            style={styles.input}
          />
        </View>
      ))}
    </View>
  );
}

/** Chỉ bản thử mới xoá tay được; đã nối máy chủ thì không, tránh mất check-in chưa gửi. */
function ClearTestData() {
  return (
    <View style={styles.actions}>
      <Button
        label="Xoá dữ liệu thử"
        variant="danger"
        onPress={() =>
          Alert.alert(
            'Xoá dữ liệu thử',
            'Xoá toàn bộ điểm GPS và ảnh thử trên máy này? Không khôi phục được.',
            [
              { text: 'Không', style: 'cancel' },
              { text: 'Xoá', style: 'destructive', onPress: clearAllTestData },
            ],
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: SPACE.lg, gap: SPACE.md, paddingBottom: SUPPORT_FAB_CLEARANCE },
  card: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: SPACE.md,
    gap: SPACE.xs,
  },
  name: { fontSize: 18, fontWeight: FONT.bold, color: COLORS.text },
  section: { fontSize: 16, fontWeight: FONT.bold, color: COLORS.text },
  body: { fontSize: 15, color: COLORS.text },
  muted: { fontSize: 14, color: COLORS.textMuted },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
  link: { minHeight: 44, justifyContent: 'center' },
  linkText: { fontSize: 15, color: COLORS.brand, fontWeight: FONT.bold },
  field: { paddingVertical: SPACE.sm, gap: SPACE.xs },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: SPACE.md,
    fontSize: 16,
    color: COLORS.text,
  },
});
