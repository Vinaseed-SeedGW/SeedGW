import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  APPROVAL_ACTION_LABEL,
  APPROVAL_KIND_LABEL,
  APPROVAL_STEP_LABEL,
  type ApprovalRow,
} from '@seedgw/contracts/approvals';
import {
  decideApproval,
  listMyApprovals,
  readApprovalPage,
  type ApprovalPage,
  type MobileApprovalTab,
} from '../api/targets';
import { formatVnDate, formatVnTime } from '../sync/geo';
import { COLORS, FONT, SPACE } from '../theme';
import { BackBar } from './back-bar';
import { Button } from './button';
import { StatusTag, TargetValues } from './target-figures';
import { Text, TextInput } from './text';

const TABS: { key: MobileApprovalTab; label: string }[] = [
  { key: 'cho-toi-duyet', label: 'Chờ tôi duyệt' },
  { key: 'da-xu-ly', label: 'Đã xử lý' },
];

function when(iso: string | null): string {
  if (!iso) return '';
  const at = Date.parse(iso);
  return `${formatVnTime(at).slice(0, 5)} ${formatVnDate(at)}`;
}

function RowItem({ row, onOpen }: { row: ApprovalRow; onOpen: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onOpen} style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.code}>{row.code}</Text>
        <StatusTag status={row.status} />
      </View>
      <Text style={styles.body}>
        {row.submittedByName}, {APPROVAL_KIND_LABEL[row.kind].toLowerCase()}{' '}
        {row.periodLabel.toLowerCase()}
      </Text>
      <Text style={styles.muted}>{row.summaryText}</Text>
      <Text style={styles.muted}>Gửi lúc {when(row.submittedAt)}</Text>
    </Pressable>
  );
}

function Decision({ code, onDone }: { code: string; onDone: (page: ApprovalPage) => void }) {
  const [mode, setMode] = useState<'approve' | 'return' | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function send() {
    if (mode === 'return' && text.trim().length < 5) {
      setError('Lý do trả lại cần ít nhất 5 ký tự');
      return;
    }
    setSaving(true);
    setError(null);
    const result = await decideApproval(
      code,
      mode === 'return'
        ? { decision: 'RETURN', reason: text }
        : { decision: 'APPROVE', note: text },
    );
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setMode(null);
    setText('');
    onDone(result.data);
  }

  if (mode === null) {
    return (
      <View style={styles.actions}>
        <Button label="Duyệt" onPress={() => setMode('approve')} />
        <Button label="Trả lại" onPress={() => setMode('return')} variant="ghost" />
      </View>
    );
  }
  return (
    <View style={styles.form}>
      <Text style={styles.muted}>
        {mode === 'return'
          ? 'Lý do trả lại (5 đến 500 ký tự), người gửi sẽ thấy'
          : 'Ghi chú khi duyệt (không bắt buộc)'}
      </Text>
      <TextInput
        value={text}
        onChangeText={setText}
        multiline
        maxLength={500}
        accessibilityLabel={mode === 'return' ? 'Lý do trả lại' : 'Ghi chú'}
        style={styles.input}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.actions}>
        {saving ? (
          <ActivityIndicator color={COLORS.brand} />
        ) : (
          <Button
            label={mode === 'return' ? 'Trả lại' : 'Duyệt'}
            onPress={() => void send()}
            variant={mode === 'return' ? 'danger' : 'primary'}
          />
        )}
        <Button label="Huỷ" onPress={() => setMode(null)} variant="ghost" />
      </View>
    </View>
  );
}

function Detail({ code, onBack }: { code: string; onBack: () => void }) {
  const [page, setPage] = useState<ApprovalPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void readApprovalPage(code).then((result) => {
      if (cancelled) return;
      if (result.ok) setPage(result.data);
      else setError(result.message);
    });
    return () => {
      cancelled = true;
    };
  }, [code]);

  return (
    <View style={styles.fill}>
      <BackBar title={`Phiếu ${code}`} onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!page && !error ? <ActivityIndicator color={COLORS.brand} /> : null}
        {page ? (
          <>
            <View style={styles.card}>
              <View style={styles.head}>
                <Text style={styles.code}>{page.approval.periodLabel}</Text>
                <StatusTag status={page.approval.status} />
              </View>
              <Text style={styles.body}>
                {page.approval.submittedByName} ({page.approval.submittedByCode})
                {page.approval.orgUnitName ? `, ${page.approval.orgUnitName}` : ''}
              </Text>
              {page.route ? (
                <>
                  {page.approval.isLate ? <Text style={styles.late}>Nộp muộn</Text> : null}
                  {page.route.proposed
                    .filter((day) => day.stops.length > 0)
                    .map((day) => (
                      <View key={day.day} style={styles.log}>
                        <Text style={styles.body}>
                          {day.label}, {day.stops.length} điểm
                        </Text>
                        {day.stops.map((stop, index) => (
                          <Text key={stop.dealerId} style={styles.muted}>
                            {index + 1}. {stop.dealerName}
                            {stop.lat === null ? ', chưa có toạ độ' : ''}
                          </Text>
                        ))}
                      </View>
                    ))}
                  {page.route.approved ? (
                    <Text style={styles.muted}>
                      Đây là bản sửa; tuyến đã duyệt trước đó vẫn hiệu lực tới khi bản này được
                      duyệt.
                    </Text>
                  ) : null}
                </>
              ) : null}
              {page.target ? (
                <TargetValues
                  proposed={page.target.proposed}
                  approved={page.target.approved}
                  progress={page.target.progress}
                />
              ) : page.route ? null : (
                <Text style={styles.muted}>{page.approval.summaryText}</Text>
              )}
              {page.target?.proposed.note ? (
                <Text style={styles.muted}>Ghi chú: {page.target.proposed.note}</Text>
              ) : null}
            </View>
            {page.approval.canReview ? <Decision code={code} onDone={setPage} /> : null}
            <View style={styles.card}>
              <Text style={styles.section}>Nhật ký phiếu</Text>
              {page.approval.actions.map((action) => (
                <View key={action.id} style={styles.log}>
                  <Text style={styles.body}>
                    {APPROVAL_ACTION_LABEL[action.action]}
                    {action.step ? `, bước ${APPROVAL_STEP_LABEL[action.step]}` : ''}
                  </Text>
                  <Text style={styles.muted}>
                    {action.actorName ?? 'Hệ thống'}, {when(action.createdAt)}
                  </Text>
                  {action.note ? <Text style={styles.muted}>{action.note}</Text> : null}
                </View>
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

/** Cần duyệt trên app cho Quản lý và Lãnh đạo đơn vị (A10b). Duyệt nhiều phiếu làm trên web. */
export function ApprovalsScreen({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<MobileApprovalTab>('cho-toi-duyet');
  const [rows, setRows] = useState<ApprovalRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openCode, setOpenCode] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setRows(null);
    const result = await listMyApprovals(tab);
    if (result.ok) {
      setRows(result.data.items);
      setError(null);
    } else {
      setError(result.message);
    }
  }, [tab]);
  useEffect(() => {
    if (openCode === null) void reload();
  }, [reload, openCode]);

  if (openCode) return <Detail code={openCode} onBack={() => setOpenCode(null)} />;

  return (
    <View style={styles.fill}>
      <BackBar title="Cần duyệt" onBack={onClose} />
      <View style={styles.tabs} accessibilityRole="tablist">
        {TABS.map((item) => (
          <Pressable
            key={item.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: item.key === tab }}
            onPress={() => setTab(item.key)}
            style={[styles.tab, item.key === tab ? styles.tabActive : null]}
          >
            <Text style={[styles.tabText, item.key === tab ? styles.tabTextActive : null]}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {error ? (
          <View style={styles.card}>
            <Text style={styles.error}>{error}</Text>
            <Button label="Thử lại" onPress={() => void reload()} variant="ghost" />
          </View>
        ) : null}
        {rows === null && !error ? <ActivityIndicator color={COLORS.brand} /> : null}
        {rows?.length === 0 ? (
          <Text style={styles.muted}>
            {tab === 'cho-toi-duyet'
              ? 'Không có phiếu nào chờ bạn duyệt.'
              : 'Bạn chưa duyệt hoặc trả lại phiếu nào.'}
          </Text>
        ) : null}
        {rows?.map((row) => (
          <RowItem key={row.code} row={row} onOpen={() => setOpenCode(row.code)} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: SPACE.lg, gap: SPACE.md },
  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACE.sm,
    paddingHorizontal: SPACE.lg,
    paddingTop: SPACE.sm,
  },
  tab: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: SPACE.md,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.surface,
  },
  tabActive: { borderBottomColor: COLORS.brand },
  tabText: { fontSize: 15, color: COLORS.textMuted, fontWeight: FONT.bold },
  tabTextActive: { color: COLORS.brand },
  card: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: SPACE.md,
    gap: SPACE.xs,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, flexWrap: 'wrap' },
  code: { fontSize: 16, fontWeight: FONT.bold, color: COLORS.brand },
  section: { fontSize: 16, fontWeight: FONT.bold, color: COLORS.text },
  body: { fontSize: 15, color: COLORS.text },
  muted: { fontSize: 14, color: COLORS.textMuted },
  error: { fontSize: 14, color: COLORS.danger },
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
  late: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.warningSoft,
    borderRadius: 4,
    paddingHorizontal: 6,
    fontSize: 13,
    color: COLORS.text,
    overflow: 'hidden',
  },
  log: {
    paddingVertical: SPACE.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
});
