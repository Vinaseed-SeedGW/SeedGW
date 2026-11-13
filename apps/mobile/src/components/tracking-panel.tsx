import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { hasGeocodeKey } from '../api/reverse-geocode';
import { formatKm, formatVnDate, formatVnTime, startOfVnDay } from '../sync/geo';
import { TRACKING_CONFIG } from '../sync/background-tracking';
import { shareDayReport } from '../sync/day-report';
import {
  clearAllTestData,
  computeDayStats,
  countTaskErrorsSince,
  getOpenSession,
  getPhotoDataUri,
  getTesterProfile,
  listDaysWithData,
  listPhotosBetween,
  saveTesterProfile,
  type DayStats,
  type PhotoSummary,
  type TesterProfile,
} from '../sync/track-db';
import { FILTER } from '../sync/track-filter';
import { COLORS, FONT, SPACE } from '../theme';
import { Button } from './button';
import type { TrackingControl } from './use-tracking';

const REFRESH_MS = 5_000;
const DAY_MS = 86_400_000;
const EXPORT_DAYS = 7;

const PERMISSION_LABEL = {
  ALWAYS: 'Luôn cho phép',
  WHEN_IN_USE: 'Chỉ khi dùng app (vết sẽ đứt khi tắt màn hình)',
  DENIED: 'Chưa cho phép',
} as const;

type Snapshot = {
  stats: DayStats;
  photos: PhotoSummary[];
  sessionStartedAt: number | null;
  taskErrors: number;
  exportDays: number[];
};

function readSnapshot(): Snapshot {
  const dayStart = startOfVnDay(Date.now());
  return {
    stats: computeDayStats(dayStart),
    photos: listPhotosBetween(dayStart, dayStart + DAY_MS),
    sessionStartedAt: getOpenSession()?.started_at ?? null,
    taskErrors: countTaskErrorsSince(dayStart),
    exportDays: listDaysWithData(EXPORT_DAYS),
  };
}

type Props = { control: TrackingControl; onOpenCamera: () => void };

export function TrackingPanel({ control, onOpenCamera }: Props) {
  const { state, actions } = control;
  const [snapshot, setSnapshot] = useState<Snapshot>(readSnapshot);
  const [viewing, setViewing] = useState<number | null>(null);
  const [exporting, setExporting] = useState<number | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  const reload = useCallback(() => setSnapshot(readSnapshot()), []);

  useEffect(() => {
    const timer = setInterval(reload, REFRESH_MS);
    return () => clearInterval(timer);
  }, [reload]);

  useEffect(reload, [state.tracking, reload]);

  async function exportDay(dayStart: number) {
    if (exporting !== null) return;
    setExporting(dayStart);
    setExportMessage(null);
    const result = await shareDayReport(dayStart);
    setExporting(null);
    reload();
    if (!result.ok) {
      setExportMessage(result.message);
      return;
    }
    setExportMessage(
      result.missingAddress > 0
        ? `Đã tạo file ${result.fileName}. Còn ${result.missingAddress} ảnh chưa có địa chỉ, khi có mạng xuất lại để bổ sung.`
        : `Đã tạo file ${result.fileName}, ${result.checkIns} lượt check-in.`,
    );
  }

  function clearData() {
    Alert.alert(
      'Xoá dữ liệu thử',
      'Xoá toàn bộ điểm GPS và ảnh thử trên máy này? Không khôi phục được.',
      [
        { text: 'Không', style: 'cancel' },
        {
          text: 'Xoá',
          style: 'destructive',
          onPress: () => {
            clearAllTestData();
            reload();
          },
        },
      ],
    );
  }

  const { stats } = snapshot;
  const todayStart = startOfVnDay(Date.now());

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>Hành trình hôm nay</Text>
      <Text style={styles.muted}>
        {formatVnDate(Date.now())}. Bản thử R3, dữ liệu chỉ nằm trên máy này.
      </Text>

      <View style={[styles.status, state.tracking ? styles.statusOn : styles.statusOff]}>
        <Text style={styles.statusText}>
          {state.tracking ? 'Đang ghi hành trình' : 'Đã dừng ghi hành trình'}
        </Text>
        {snapshot.sessionStartedAt !== null ? (
          <Text style={styles.statusSub}>
            Bắt đầu lúc {formatVnTime(snapshot.sessionStartedAt)}
          </Text>
        ) : null}
      </View>
      {state.message ? <Text style={styles.error}>{state.message}</Text> : null}

      <View style={styles.actions}>
        <Button label="Chụp ảnh check-in" onPress={onOpenCamera} />
        {state.tracking ? (
          <Button label="Kết thúc ngày" onPress={() => void actions.stop()} variant="ghost" />
        ) : (
          <Button label="Bắt đầu ghi" onPress={() => void actions.start()} variant="ghost" />
        )}
      </View>

      <View style={styles.card}>
        <Row label="Quyền vị trí" value={PERMISSION_LABEL[state.permission]} />
        <Row
          label="Điểm GPS hôm nay"
          value={`${stats.pointCount}, trong đó ${stats.backgroundCount} điểm khi app ở nền`}
        />
        <Row
          label="Điểm gần nhất"
          value={
            stats.lastPoint
              ? `${formatVnTime(stats.lastPoint.recordedAt)}, sai số ${Math.round(stats.lastPoint.accuracy ?? 0)} m`
              : 'Chưa có'
          }
        />
        <Row label="Km theo GPS (đã lọc)" value={`${formatKm(stats.gpsDistanceM)} km`} />
        <Row
          label={`Chỗ đứng yên đã gộp (từ ${FILTER.stopMinSeconds / 60} phút trong ${FILTER.stopRadiusM} m)`}
          value={String(stats.stopCount)}
        />
        <Row
          label={`Điểm sai số trên ${FILTER.maxAccuracyM} m`}
          value={String(stats.poorAccuracyCount)}
        />
        <Row label="Điểm từ ứng dụng giả lập vị trí" value={String(stats.mockedCount)} />
        <Row
          label={`Đoạn đứt (quá ${FILTER.gapMinutes} phút và quá ${FILTER.gapMeters} m)`}
          value={
            stats.gapCount > 0
              ? `${stats.gapCount}, dài nhất ${Math.round(stats.longestGapMinutes)} phút`
              : 'Không có'
          }
        />
        <Row label="Lỗi khi chạy nền" value={String(snapshot.taskErrors)} />
      </View>
      <Text style={styles.muted}>
        Ghi {TRACKING_CONFIG.timeIntervalMs / 1000} giây một lần, chỉ khi đã đi thêm{' '}
        {TRACKING_CONFIG.distanceIntervalM} m. Tự dừng lúc {TRACKING_CONFIG.autoStopHourVn}:00.
      </Text>

      <Text style={styles.section}>Ảnh đã chụp hôm nay ({stats.photoCount})</Text>
      {snapshot.photos.length === 0 ? (
        <Text style={styles.muted}>Chưa có ảnh. Bấm Chụp ảnh check-in để thử máy ảnh.</Text>
      ) : (
        <View style={styles.photoList}>
          {snapshot.photos.map((photo) => (
            <Pressable
              key={photo.id}
              accessibilityRole="button"
              accessibilityLabel={`Xem ảnh lúc ${formatVnTime(photo.takenAt)}`}
              onPress={() => setViewing(photo.id)}
              style={styles.photoItem}
            >
              <Text style={styles.photoTime}>
                {formatVnTime(photo.takenAt).slice(0, 5)}
                {photo.placeName ? `  ${photo.placeName}` : ''}
              </Text>
              <Text style={styles.muted}>{photo.address ?? 'Chưa có địa chỉ'}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <Text style={styles.section}>Xuất báo cáo Excel</Text>
      <Text style={styles.muted}>
        File theo mẫu Báo cáo cự ly di chuyển: mỗi lượt check-in một dòng, có địa chỉ, km theo GPS
        và ảnh. Kèm trang Tổng hợp và trang Điểm GPS.
      </Text>
      <ProfileForm />
      {!hasGeocodeKey() ? (
        <Text style={styles.error}>Bản cài này chưa có khoá bản đồ nên chưa ra được địa chỉ.</Text>
      ) : null}
      {snapshot.exportDays.length === 0 ? (
        <Text style={styles.muted}>Chưa có dữ liệu để xuất.</Text>
      ) : (
        <View style={styles.actions}>
          {snapshot.exportDays.map((day) => (
            <Button
              key={day}
              label={
                exporting === day
                  ? 'Đang tạo file'
                  : day === todayStart
                    ? `Hôm nay, ${formatVnDate(day).slice(0, 5)}`
                    : formatVnDate(day)
              }
              onPress={() => void exportDay(day)}
              variant={day === todayStart ? 'primary' : 'ghost'}
            />
          ))}
        </View>
      )}
      {exportMessage ? <Text style={styles.muted}>{exportMessage}</Text> : null}

      <View style={styles.actions}>
        <Button label="Xoá dữ liệu thử" onPress={clearData} variant="danger" />
      </View>

      <PhotoViewer photoId={viewing} onClose={() => setViewing(null)} />
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
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
    <View style={styles.card}>
      {PROFILE_FIELDS.map((field) => (
        <View key={field.key} style={styles.field}>
          <Text style={styles.rowLabel}>{field.label}</Text>
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

function PhotoViewer({ photoId, onClose }: { photoId: number | null; onClose: () => void }) {
  const uri = photoId === null ? null : getPhotoDataUri(photoId);
  return (
    <Modal visible={uri !== null} animationType="fade" onRequestClose={onClose}>
      <View style={styles.viewer}>
        {uri ? (
          <Image
            source={{ uri }}
            style={styles.viewerImage}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
        ) : null}
        <View style={styles.viewerActions}>
          <Button label="Đóng" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  content: { padding: SPACE.lg, gap: SPACE.md, backgroundColor: COLORS.surface },
  title: { fontSize: 22, fontWeight: FONT.bold, color: COLORS.text },
  section: { fontSize: 17, fontWeight: FONT.bold, color: COLORS.text, marginTop: SPACE.sm },
  muted: { fontSize: 14, color: COLORS.textMuted },
  error: { fontSize: 14, color: COLORS.danger },
  status: { borderRadius: 8, padding: SPACE.md },
  statusOn: { backgroundColor: COLORS.brandSoft },
  statusOff: { backgroundColor: COLORS.surfaceSubtle },
  statusText: { fontSize: 16, fontWeight: FONT.bold, color: COLORS.text },
  statusSub: { fontSize: 14, color: COLORS.textMuted, marginTop: SPACE.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
  card: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: SPACE.md,
  },
  row: {
    paddingVertical: SPACE.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  rowLabel: { fontSize: 13, color: COLORS.textMuted },
  rowValue: { fontSize: 15, color: COLORS.text, marginTop: 2 },
  photoList: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
  photoItem: {
    width: '100%',
    minHeight: 48,
    padding: SPACE.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
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
  photoTime: { fontSize: 15, fontWeight: FONT.bold, color: COLORS.text },
  viewer: { flex: 1, backgroundColor: COLORS.text },
  viewerImage: { flex: 1 },
  viewerActions: { padding: SPACE.lg, backgroundColor: COLORS.surface },
});
