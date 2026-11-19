import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { CHECK_IN_FLAG_LABEL, CHECK_IN_PLACE_KIND_LABEL } from '@dms/contracts/check-ins';
import { shareDayReport } from '../sync/day-report';
import { formatVnDate, formatVnTime, startOfVnDay } from '../sync/geo';
import {
  currentMonth,
  loadHistoryMonth,
  shiftMonth,
  type HistoryEntry,
  type HistoryMonth,
} from '../sync/history';
import { COLORS, FONT, SPACE } from '../theme';
import { SUPPORT_FAB_CLEARANCE } from './support-fab';
import { Button } from './button';
import { PhotoViewer, type PhotoTarget } from './photo-viewer';
import { Text } from './text';

const WEEKDAYS = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const VN_OFFSET_MS = 7 * 3_600_000;

const STATUS_LABEL: Record<Exclude<HistoryEntry['status'], 'SERVER'>, string> = {
  PENDING: 'Chờ gửi',
  FAILED: 'Máy chủ không nhận',
  DEVICE_ONLY: 'Chỉ có trên máy',
};

function kmText(km: number): string {
  return km.toFixed(3).replace('.', ',');
}

function monthTitle(month: string): string {
  const [year, value] = month.split('-');
  return `Tháng ${Number(value)}/${year}`;
}

function dayTitle(dayStart: number): string {
  const weekday = WEEKDAYS[new Date(dayStart + VN_OFFSET_MS).getUTCDay()] ?? '';
  return `${weekday}, ${formatVnDate(dayStart)}`;
}

type Day = { dayStart: number; entries: HistoryEntry[]; km: number; hasLocal: boolean };

function groupByDay(entries: readonly HistoryEntry[]): Day[] {
  const days = new Map<number, HistoryEntry[]>();
  for (const entry of entries) {
    const day = startOfVnDay(entry.capturedAt);
    days.set(day, [...(days.get(day) ?? []), entry]);
  }
  return [...days.entries()]
    .sort(([a], [b]) => b - a)
    .map(([dayStart, list]) => ({
      dayStart,
      entries: list,
      km: list.reduce((sum, entry) => sum + (entry.legKm ?? 0), 0),
      hasLocal: list.some((entry) => entry.localPhotoId !== null),
    }));
}

/**
 * Tab Lịch sử (M6): toàn bộ check-in của tôi trong 18 tháng, theo tháng và theo ngày. Có mạng lấy máy chủ,
 * mất mạng lấy trên máy; lượt chưa gửi gắn Chờ gửi. Km từng chặng và tổng km theo ngày.
 */
export function HistoryTab() {
  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState<HistoryMonth | null>(null);
  const [loading, setLoading] = useState(true);
  const [photo, setPhoto] = useState<PhotoTarget>(null);
  const [exporting, setExporting] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async (target: string) => {
    setLoading(true);
    const result = await loadHistoryMonth(target);
    setData(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load(month);
  }, [month, load]);

  async function exportDay(dayStart: number) {
    if (exporting !== null) return;
    setExporting(dayStart);
    setMessage(null);
    const result = await shareDayReport(dayStart);
    setExporting(null);
    setMessage(
      result.ok
        ? result.missingAddress > 0
          ? `Đã tạo file ${result.fileName}. Còn ${result.missingAddress} ảnh chưa có địa chỉ, khi có mạng xuất lại để bổ sung.`
          : `Đã tạo file ${result.fileName}, ${result.checkIns} lượt check-in.`
        : result.message,
    );
  }

  const thisMonth = currentMonth();
  const days = data && data.month === month ? groupByDay(data.entries) : [];
  const canGoBack = data ? month > data.earliestMonth : false;

  return (
    <View style={styles.fill}>
      <View style={styles.monthBar}>
        {canGoBack ? (
          <Button
            label="Tháng trước"
            onPress={() => setMonth(shiftMonth(month, -1))}
            variant="ghost"
          />
        ) : (
          <View style={styles.navSpacer} />
        )}
        <Text style={styles.monthTitle}>{monthTitle(month)}</Text>
        {month < thisMonth ? (
          <Button
            label="Tháng sau"
            onPress={() => setMonth(shiftMonth(month, 1))}
            variant="ghost"
          />
        ) : (
          <View style={styles.navSpacer} />
        )}
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load(month)} />}
      >
        {data?.notice ? <Text style={styles.notice}>{data.notice}</Text> : null}
        {message ? <Text style={styles.muted}>{message}</Text> : null}
        {!loading && days.length === 0 ? (
          <Text style={styles.muted}>Chưa có lượt check-in nào trong tháng này.</Text>
        ) : null}
        {days.map((day) => (
          <View key={day.dayStart} style={styles.day}>
            <View style={styles.dayHead}>
              <View style={styles.flex}>
                <Text style={styles.dayTitle}>{dayTitle(day.dayStart)}</Text>
                <Text style={styles.muted}>
                  {day.entries.length} lượt, {kmText(day.km)} km theo GPS
                </Text>
              </View>
              {day.hasLocal ? (
                <Button
                  label={exporting === day.dayStart ? 'Đang tạo file' : 'Xuất Excel'}
                  onPress={() => void exportDay(day.dayStart)}
                  variant="ghost"
                />
              ) : null}
            </View>
            {day.entries.map((entry, index) => (
              <Entry
                key={entry.key}
                entry={entry}
                first={index === 0}
                onViewPhoto={() =>
                  setPhoto({ localPhotoId: entry.localPhotoId, clientId: entry.clientId })
                }
              />
            ))}
          </View>
        ))}
        {data && !canGoBack ? (
          <Text style={styles.muted}>Lượt check-in giữ 18 tháng, ảnh giữ 45 ngày rồi tự xoá.</Text>
        ) : null}
      </ScrollView>
      <PhotoViewer target={photo} onClose={() => setPhoto(null)} />
    </View>
  );
}

function Entry({
  entry,
  first,
  onViewPhoto,
}: {
  entry: HistoryEntry;
  first: boolean;
  onViewPhoto: () => void;
}) {
  const hasPhoto = entry.localPhotoId !== null || entry.remotePhoto;
  return (
    <View style={styles.entry}>
      <View style={styles.entryHead}>
        <Text style={styles.time}>{formatVnTime(entry.capturedAt).slice(0, 5)}</Text>
        <View style={styles.flex}>
          <Text style={styles.place}>
            {entry.placeName || 'Chưa đặt tên'}
            {entry.placeKind === 'DEALER' ? '' : `, ${CHECK_IN_PLACE_KIND_LABEL[entry.placeKind]}`}
          </Text>
          {entry.address ? <Text style={styles.muted}>{entry.address}</Text> : null}
          <Text style={styles.muted}>
            {first
              ? 'Lượt đầu ngày'
              : entry.legKm === null
                ? 'Km đang tính'
                : `${kmText(entry.legKm)} km ${entry.legSource === 'ROAD' ? 'theo đường' : 'theo GPS'} từ lượt trước${entry.estimated ? ', ước tính' : ''}`}
          </Text>
          {entry.note ? <Text style={styles.body}>Ghi chú: {entry.note}</Text> : null}
          {entry.farReason ? <Text style={styles.body}>Lý do xa: {entry.farReason}</Text> : null}
          <View style={styles.tags}>
            {entry.status === 'SERVER' ? null : (
              <Text style={[styles.tag, styles.tagWarning]}>{STATUS_LABEL[entry.status]}</Text>
            )}
            {entry.flags.map((flag) => (
              <Text key={flag} style={[styles.tag, styles.tagWarning]}>
                {CHECK_IN_FLAG_LABEL[flag]}
              </Text>
            ))}
          </View>
        </View>
      </View>
      {hasPhoto ? (
        <View style={styles.photoAction}>
          <Button label="Xem ảnh" onPress={onViewPhoto} variant="ghost" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACE.sm,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  monthTitle: { fontSize: 17, fontWeight: FONT.bold, color: COLORS.text },
  navSpacer: { width: 88 },
  content: { padding: SPACE.lg, gap: SPACE.lg, paddingBottom: SUPPORT_FAB_CLEARANCE },
  notice: {
    fontSize: 14,
    color: COLORS.text,
    backgroundColor: COLORS.warningSoft,
    padding: SPACE.sm,
    borderRadius: 8,
  },
  day: { gap: SPACE.sm },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  dayTitle: { fontSize: 16, fontWeight: FONT.bold, color: COLORS.brand },
  entry: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: SPACE.md,
    gap: SPACE.xs,
  },
  entryHead: { flexDirection: 'row', gap: SPACE.md },
  time: { fontSize: 16, fontWeight: FONT.bold, color: COLORS.text, minWidth: 48 },
  place: { fontSize: 16, fontWeight: FONT.bold, color: COLORS.text },
  body: { fontSize: 14, color: COLORS.text },
  muted: { fontSize: 14, color: COLORS.textMuted },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.xs },
  tag: { fontSize: 12, paddingHorizontal: SPACE.sm, paddingVertical: 2, borderRadius: 4 },
  tagWarning: { backgroundColor: COLORS.warningSoft, color: COLORS.text },
  photoAction: { flexDirection: 'row', justifyContent: 'flex-end' },
});
