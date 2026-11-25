import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import {
  CONSENT_ACTION_LABEL,
  CONSENT_CHANNEL_LABEL,
  shortConsentCode,
  type ConsentRecordView,
} from '@seedgw/contracts/consents';
import { loadConsentRecords } from '../api/consent';
import { formatVnDate, formatVnTime } from '../sync/geo';
import { COLORS, FONT, SPACE } from '../theme';
import { BackBar } from './back-bar';
import { Button } from './button';
import { Text } from './text';

function when(iso: string): string {
  const at = Date.parse(iso);
  return `${formatVnTime(at).slice(0, 5)} ${formatVnDate(at)}`;
}

/** Giấy xác nhận dạng chữ để chia sẻ: lưu vào ghi chú, gửi email cho chính mình, hoặc in. */
function certificateText(record: ConsentRecordView): string {
  const device = [record.deviceName, record.devicePlatform].filter(Boolean).join(', ');
  return [
    `GIẤY XÁC NHẬN ${CONSENT_ACTION_LABEL[record.action].toUpperCase()} XỬ LÝ DỮ LIỆU CÁ NHÂN`,
    `Người: ${record.fullName} (${record.employeeCode})`,
    `Hành động: ${CONSENT_ACTION_LABEL[record.action]}`,
    `Thời điểm: ${when(record.recordedAt)} (giờ máy chủ)`,
    `Kênh: ${CONSENT_CHANNEL_LABEL[record.channel]}${device ? `, ${device}` : ''}`,
    `Phiên bản nội dung: ${record.version}`,
    `Mã kiểm chứng: ${shortConsentCode(record.recordHash)}`,
    `Mã đầy đủ (SHA-256): ${record.recordHash}`,
    `Mã dòng trước: ${record.prevHash}`,
    '',
    'TOÀN VĂN NỘI DUNG ĐÃ HIỂN THỊ',
    record.contentText,
  ].join('\n');
}

function Detail({ record, onBack }: { record: ConsentRecordView; onBack: () => void }) {
  return (
    <View style={styles.fill}>
      <BackBar title="Giấy xác nhận" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>{CONSENT_ACTION_LABEL[record.action]}</Text>
          <Text style={styles.body}>
            {record.fullName} ({record.employeeCode})
          </Text>
          <Text style={styles.muted}>{when(record.recordedAt)}, giờ máy chủ</Text>
          <Text style={styles.muted}>
            {CONSENT_CHANNEL_LABEL[record.channel]}
            {record.deviceName ? `, ${record.deviceName}` : ''}
          </Text>
          <Text style={styles.section}>Mã kiểm chứng</Text>
          <Text selectable style={styles.code}>
            {shortConsentCode(record.recordHash)}
          </Text>
          <Text selectable style={styles.hash}>
            {record.recordHash}
          </Text>
          {record.migrated ? (
            <Text style={styles.muted}>
              Chuyển từ dữ liệu đồng ý trước ngày 25/11/2026, khi đó chưa ghi thiết bị.
            </Text>
          ) : null}
        </View>
        <Button
          label="Chia sẻ, lưu hoặc in"
          onPress={() => void Share.share({ message: certificateText(record) })}
        />
        <View style={styles.card}>
          <Text style={styles.section}>Toàn văn nội dung đã hiển thị</Text>
          <Text selectable style={styles.body}>
            {record.contentText}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

/** Đồng ý của tôi (25/11/2026): mỗi lần đồng ý, rút lại; kiểm chứng mã trên web SeedGW. */
export function ConsentRecordsScreen({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<ConsentRecordView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<ConsentRecordView | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadConsentRecords().then((result) => {
      if (cancelled) return;
      if (result.ok) setItems(result.items);
      else setError(result.message);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (open) return <Detail record={open} onBack={() => setOpen(null)} />;

  return (
    <View style={styles.fill}>
      <BackBar title="Đồng ý của tôi" onBack={onClose} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.muted}>
          Mỗi lần bạn đồng ý hay rút lại được ghi vào sổ đồng ý, kèm toàn văn và mã kiểm chứng. Bấm
          vào từng dòng để xem và chia sẻ giấy xác nhận.
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {items === null && !error ? <ActivityIndicator color={COLORS.brand} /> : null}
        {items?.length === 0 ? (
          <Text style={styles.muted}>Chưa có lần đồng ý hay rút lại nào trên máy chủ.</Text>
        ) : null}
        {items?.map((record) => (
          <Pressable
            key={record.id}
            accessibilityRole="button"
            onPress={() => setOpen(record)}
            style={styles.card}
          >
            <Text style={styles.title}>{CONSENT_ACTION_LABEL[record.action]}</Text>
            <Text style={styles.muted}>
              {when(record.recordedAt)}, {CONSENT_CHANNEL_LABEL[record.channel]}
            </Text>
            <Text style={styles.body}>Mã {shortConsentCode(record.recordHash)}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: SPACE.lg, gap: SPACE.md },
  card: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: SPACE.md,
    gap: SPACE.xs,
  },
  title: { fontSize: 16, fontWeight: FONT.bold, color: COLORS.brand },
  section: { fontSize: 15, fontWeight: FONT.bold, color: COLORS.text, marginTop: SPACE.sm },
  body: { fontSize: 15, color: COLORS.text },
  muted: { fontSize: 14, color: COLORS.textMuted },
  error: { fontSize: 14, color: COLORS.danger },
  code: { fontSize: 20, fontWeight: FONT.bold, color: COLORS.brand, letterSpacing: 1 },
  hash: { fontSize: 13, color: COLORS.textMuted },
});
