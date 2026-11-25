import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import type {
  MobileProposalReviewItem,
  MobileProposalReviewList,
} from '@seedgw/contracts/dealer-proposals';
import { decideProposal, listProposalReview } from '../api/dealer-proposal-review';
import { formatVnDate, formatVnTime } from '../sync/geo';
import { COLORS, FONT, SPACE } from '../theme';
import { Button } from './button';
import { Text, TextInput } from './text';

function when(iso: string): string {
  const at = Date.parse(iso);
  return `${formatVnTime(at).slice(0, 5)} ${formatVnDate(at)}`;
}

function ProposalCard({
  item,
  onDone,
}: {
  item: MobileProposalReviewItem;
  onDone: (list: MobileProposalReviewList) => void;
}) {
  const [mode, setMode] = useState<'approve' | 'reject' | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function send() {
    if (mode === 'reject' && note.trim().length < 5) {
      setError('Lý do từ chối cần ít nhất 5 ký tự');
      return;
    }
    setSaving(true);
    setError(null);
    const result = await decideProposal(
      item.id,
      mode === 'reject' ? { decision: 'REJECT', note } : { decision: 'APPROVE' },
    );
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onDone(result.data);
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{item.name}</Text>
      <Text style={styles.body}>
        {item.phone}, {item.levelLabel}
      </Text>
      <Text style={styles.body}>{item.address}</Text>
      {item.ownerName ? <Text style={styles.muted}>Chủ đại lý: {item.ownerName}</Text> : null}
      {item.taxCode ? <Text style={styles.muted}>Mã số thuế: {item.taxCode}</Text> : null}
      <Text style={styles.muted}>
        {item.proposedByName} chụp lúc {when(item.capturedAt)}
      </Text>
      {item.checkInAddress ? (
        <Text style={styles.muted}>Vị trí lúc chụp: {item.checkInAddress}</Text>
      ) : null}
      {item.duplicates.length > 0 ? (
        <View style={styles.warn}>
          <Text style={styles.warnTitle}>Có thể trùng đại lý có sẵn</Text>
          {item.duplicates.map((candidate, index) => (
            <Text key={`${candidate.name}-${index}`} style={styles.body}>
              {candidate.name}: {candidate.reasons}
            </Text>
          ))}
          <Text style={styles.muted}>Muốn đánh dấu trùng thì xử lý trên web.</Text>
        </View>
      ) : null}

      {mode === null ? (
        <View style={styles.actions}>
          <Button label="Duyệt" onPress={() => setMode('approve')} />
          <Button label="Từ chối" onPress={() => setMode('reject')} variant="ghost" />
        </View>
      ) : (
        <View style={styles.form}>
          {mode === 'reject' ? (
            <>
              <Text style={styles.muted}>
                Lý do từ chối (5 đến 500 ký tự), người đề xuất sẽ thấy
              </Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                multiline
                maxLength={500}
                accessibilityLabel="Lý do từ chối"
                style={styles.input}
              />
            </>
          ) : (
            <Text style={styles.muted}>
              Tạo đại lý đúng như đề xuất, người đề xuất phụ trách. Muốn sửa thông tin thì duyệt
              trên web.
            </Text>
          )}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.actions}>
            {saving ? (
              <ActivityIndicator color={COLORS.brand} />
            ) : (
              <Button
                label={mode === 'reject' ? 'Từ chối' : 'Tạo đại lý'}
                onPress={() => void send()}
                variant={mode === 'reject' ? 'danger' : 'primary'}
              />
            )}
            <Button label="Huỷ" onPress={() => setMode(null)} variant="ghost" />
          </View>
        </View>
      )}
    </View>
  );
}

/** Mục Đại lý mới trong Cần duyệt: đề xuất chờ mình duyệt, duyệt nhanh hoặc từ chối. */
export function ProposalReviewList() {
  const [items, setItems] = useState<MobileProposalReviewItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setItems(null);
    const result = await listProposalReview();
    if (result.ok) {
      setItems(result.data.items);
      setError(null);
    } else {
      setError(result.message);
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <>
      {error ? (
        <View style={styles.card}>
          <Text style={styles.error}>{error}</Text>
          <Button label="Thử lại" onPress={() => void reload()} variant="ghost" />
        </View>
      ) : null}
      {items === null && !error ? <ActivityIndicator color={COLORS.brand} /> : null}
      {items?.length === 0 ? (
        <Text style={styles.muted}>Không có đề xuất đại lý mới nào chờ bạn duyệt.</Text>
      ) : null}
      {items?.map((item) => (
        <ProposalCard key={item.id} item={item} onDone={(list) => setItems(list.items)} />
      ))}
    </>
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
  title: { fontSize: 16, fontWeight: FONT.bold, color: COLORS.brand },
  body: { fontSize: 15, color: COLORS.text },
  muted: { fontSize: 14, color: COLORS.textMuted },
  error: { fontSize: 14, color: COLORS.danger },
  warn: {
    backgroundColor: COLORS.warningSoft,
    borderRadius: 8,
    padding: SPACE.sm,
    gap: SPACE.xs,
  },
  warnTitle: { fontSize: 14, fontWeight: FONT.bold, color: COLORS.text },
  form: { gap: SPACE.sm },
  input: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: SPACE.md,
    fontSize: 16,
    color: COLORS.text,
    textAlignVertical: 'top',
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm, alignItems: 'center' },
});
