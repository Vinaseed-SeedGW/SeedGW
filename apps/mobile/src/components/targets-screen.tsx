import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from 'react-native';
import { PENDING_APPROVAL_STATUSES } from '@dms/contracts/approvals';
import {
  upsertSalesTargetInput,
  type MyTargetMonth,
  type MyTargetsResult,
} from '@dms/contracts/sales-targets';
import { loadMyTargets, submitMyTarget, withdrawMyApproval } from '../api/targets';
import { COLORS, FONT, SPACE } from '../theme';
import { BackBar } from './back-bar';
import { Button } from './button';
import { StatusTag, TargetValues } from './target-figures';
import { Text, TextInput } from './text';

type Draft = { visit: string; dealers: string; kg: string; note: string };

function draftOf(month: MyTargetMonth): Draft {
  const proposed = month.target?.proposed;
  return {
    visit: proposed ? String(proposed.visitCountTarget) : '',
    dealers: proposed ? String(proposed.dealerCoverageTarget) : '',
    kg: proposed ? String(proposed.salesKgTarget) : '0',
    note: proposed?.note ?? '',
  };
}

function TargetForm({
  month,
  onSaved,
  onCancel,
}: {
  month: MyTargetMonth;
  onSaved: (data: MyTargetsResult) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => draftOf(month));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    const parsed = upsertSalesTargetInput.safeParse({
      month: month.month,
      visitCountTarget: draft.visit.trim(),
      dealerCoverageTarget: draft.dealers.trim(),
      salesKgTarget: draft.kg.trim().replace(',', '.') || '0',
      note: draft.note,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Kiểm tra lại số đã nhập');
      return;
    }
    setSaving(true);
    setError(null);
    const result = await submitMyTarget(parsed.data);
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onSaved(result.data);
  }

  const field = (key: keyof Draft, label: string, numeric: boolean) => (
    <View style={styles.field}>
      <Text style={styles.muted}>{label}</Text>
      <TextInput
        value={draft[key]}
        onChangeText={(value) => setDraft((current) => ({ ...current, [key]: value }))}
        keyboardType={numeric ? 'numeric' : 'default'}
        accessibilityLabel={label}
        maxLength={numeric ? 9 : 500}
        style={styles.input}
      />
    </View>
  );

  return (
    <View style={styles.form}>
      {month.target?.approved ? (
        <Text style={styles.notice}>
          Bản sửa phải được duyệt lại. Trong lúc chờ, chỉ tiêu đã duyệt vẫn có hiệu lực.
        </Text>
      ) : null}
      {field('visit', 'Lượt ghé thăm trong tháng', true)}
      {field('dealers', 'Số đại lý được ghé', true)}
      {field('kg', 'Thực bán (kg), để 0 nếu chưa giao', true)}
      {field('note', 'Ghi chú (không bắt buộc)', false)}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.actions}>
        {saving ? (
          <ActivityIndicator color={COLORS.brand} />
        ) : (
          <Button label="Gửi duyệt" onPress={() => void save()} />
        )}
        <Button label="Huỷ" onPress={onCancel} variant="ghost" />
      </View>
    </View>
  );
}

function MonthCard({
  month,
  onChange,
}: {
  month: MyTargetMonth;
  onChange: (data: MyTargetsResult) => void;
}) {
  const [editing, setEditing] = useState(false);
  const target = month.target;
  const pending =
    target?.approvalStatus != null && PENDING_APPROVAL_STATUSES.includes(target.approvalStatus);

  function confirmWithdraw(code: string) {
    Alert.alert('Rút lại phiếu', `Rút lại phiếu ${code}? Bạn sửa rồi gửi lại khi cần.`, [
      { text: 'Không', style: 'cancel' },
      {
        text: 'Rút lại',
        style: 'destructive',
        onPress: () => {
          void withdrawMyApproval(code).then((result) => {
            if (result.ok) onChange(result.data);
            else Alert.alert('Chưa rút lại được', result.message);
          });
        },
      },
    ]);
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle}>{month.monthLabel}</Text>
        {target?.approvalStatus ? <StatusTag status={target.approvalStatus} /> : null}
      </View>
      {target?.approvalCode ? <Text style={styles.muted}>Phiếu {target.approvalCode}</Text> : null}
      {target?.returnReason ? (
        <Text style={styles.returned}>Lý do trả lại: {target.returnReason}</Text>
      ) : null}
      {target ? (
        <TargetValues
          proposed={target.proposed}
          approved={target.approved}
          progress={month.progress}
        />
      ) : (
        <Text style={styles.muted}>
          {month.editable ? 'Chưa đăng ký chỉ tiêu tháng này.' : 'Không có chỉ tiêu tháng này.'}
        </Text>
      )}
      {editing ? (
        <TargetForm
          month={month}
          onCancel={() => setEditing(false)}
          onSaved={(data) => {
            setEditing(false);
            onChange(data);
          }}
        />
      ) : month.editable ? (
        <View style={styles.actions}>
          {pending ? null : (
            <Button
              label={target ? 'Sửa chỉ tiêu' : 'Đăng ký chỉ tiêu'}
              onPress={() => setEditing(true)}
              variant={target ? 'ghost' : 'primary'}
            />
          )}
          {target?.canWithdraw && target.approvalCode ? (
            <Button
              label="Rút lại phiếu"
              onPress={() => confirmWithdraw(target.approvalCode ?? '')}
              variant="ghost"
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** Màn Chỉ tiêu của tôi: đăng ký, sửa tháng này và tháng sau; tháng đã qua chỉ xem (K3a). */
export function TargetsScreen({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<MyTargetsResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const result = await loadMyTargets();
    if (result.ok) {
      setData(result.data);
      setError(null);
    } else {
      setError(result.message);
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <View style={styles.fill}>
      <BackBar title="Chỉ tiêu của tôi" onBack={onClose} />
      <ScrollView contentContainerStyle={styles.content}>
        {error ? (
          <View style={styles.card}>
            <Text style={styles.error}>{error}</Text>
            <Button label="Thử lại" onPress={() => void reload()} variant="ghost" />
          </View>
        ) : null}
        {data === null && !error ? <ActivityIndicator color={COLORS.brand} /> : null}
        {data?.months.map((month) => (
          <MonthCard key={month.month} month={month} onChange={setData} />
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
    gap: SPACE.sm,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, flexWrap: 'wrap' },
  cardTitle: { fontSize: 17, fontWeight: FONT.bold, color: COLORS.brand },
  form: { gap: SPACE.xs, marginTop: SPACE.xs },
  field: { gap: SPACE.xs },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: SPACE.md,
    fontSize: 16,
    color: COLORS.text,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm, alignItems: 'center' },
  notice: {
    backgroundColor: COLORS.warningSoft,
    borderRadius: 8,
    padding: SPACE.sm,
    fontSize: 14,
    color: COLORS.text,
  },
  returned: {
    backgroundColor: COLORS.dangerSoft,
    borderRadius: 8,
    padding: SPACE.sm,
    fontSize: 14,
    color: COLORS.danger,
  },
  muted: { fontSize: 14, color: COLORS.textMuted },
  error: { fontSize: 14, color: COLORS.danger },
});
