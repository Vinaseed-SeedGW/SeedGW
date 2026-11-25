import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import * as Location from 'expo-location';
import { PENDING_APPROVAL_STATUSES } from '@seedgw/contracts/approvals';
import type { MobileDealerOption } from '@seedgw/contracts/dealers';
import {
  formatRouteDay,
  formatRouteDayShort,
  MAX_STOPS_PER_DAY,
  ROUTE_KIND_LABEL,
  sortByNearest,
  submitRoutePlanInput,
  type MyRoutePeriod,
  type MyRoutesResult,
} from '@seedgw/contracts/route-plans';
import { loadMyRoutes, submitMyRoute, withdrawRoute } from '../api/routes';
import { formatVnDate, formatVnTime } from '../sync/geo';
import { clearRouteDraft, getRouteDraft, saveRouteDraft } from '../sync/track-db';
import { COLORS, FONT, SPACE } from '../theme';
import { BackBar } from './back-bar';
import { Button } from './button';
import { DealerResults, useDealerSearch } from './dealer-picker';
import { StatusTag } from './target-figures';
import { Text, TextInput } from './text';

type DraftStop = {
  dealerId: string;
  dealerName: string;
  address: string;
  lat: number | null;
  lng: number | null;
};
type Draft = { days: Record<string, DraftStop[]>; note: string };

const VISIBLE_RESULTS = 15;

function periodKey(period: MyRoutePeriod) {
  return `${period.kind}:${period.periodStart}`;
}

function when(iso: string): string {
  const at = Date.parse(iso);
  return `${formatVnTime(at).slice(0, 5)} ${formatVnDate(at)}`;
}

/** Nháp trên máy nếu có, không thì lấy bản đã gửi gần nhất để sửa. */
function initialDraft(period: MyRoutePeriod): Draft {
  const saved = getRouteDraft(periodKey(period));
  if (saved) {
    try {
      return JSON.parse(saved) as Draft;
    } catch {
      // Nháp hỏng thì bỏ, lấy từ máy chủ.
    }
  }
  const days: Record<string, DraftStop[]> = {};
  for (const day of period.days) days[day] = [];
  for (const day of period.plan?.proposed ?? []) {
    days[day.day] = day.stops.map((stop) => ({
      dealerId: stop.dealerId,
      dealerName: stop.dealerName,
      address: stop.address,
      lat: stop.lat,
      lng: stop.lng,
    }));
  }
  return { days, note: period.plan?.note ?? '' };
}

function RouteEditor({
  period,
  onDone,
  onCancel,
}: {
  period: MyRoutePeriod;
  onDone: (data: MyRoutesResult) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => initialDraft(period));
  const [day, setDay] = useState(period.days[0] ?? period.periodStart);
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const search = useDealerSearch(query, null, adding);
  const stops = draft.days[day] ?? [];

  function update(next: DraftStop[]) {
    setDraft((current) => ({ ...current, days: { ...current.days, [day]: next } }));
  }

  function add(dealer: MobileDealerOption) {
    if (stops.some((stop) => stop.dealerId === dealer.id)) {
      setError(`${dealer.name} đã có trong ngày này`);
      return;
    }
    if (stops.length >= MAX_STOPS_PER_DAY) {
      setError(`Tối đa ${MAX_STOPS_PER_DAY} điểm mỗi ngày`);
      return;
    }
    setError(null);
    update([
      ...stops,
      {
        dealerId: dealer.id,
        dealerName: dealer.name,
        address: dealer.address,
        lat: dealer.lat,
        lng: dealer.lng,
      },
    ]);
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= stops.length) return;
    const next = [...stops];
    const [item] = next.splice(index, 1);
    if (item) next.splice(target, 0, item);
    update(next);
  }

  async function sortNearest() {
    let start: { lat: number; lng: number } | null = null;
    try {
      const last = await Location.getLastKnownPositionAsync();
      if (last) start = { lat: last.coords.latitude, lng: last.coords.longitude };
    } catch {
      // Không có vị trí thì bắt đầu từ điểm đầu danh sách.
    }
    update(sortByNearest(stops, start));
  }

  function saveDraft() {
    saveRouteDraft(periodKey(period), JSON.stringify(draft));
    Alert.alert('Đã lưu nháp', 'Nháp nằm trên máy này, gửi duyệt khi sẵn sàng.');
  }

  async function submit() {
    const parsed = submitRoutePlanInput.safeParse({
      kind: period.kind,
      periodStart: period.periodStart,
      days: period.days.map((item) => ({
        day: item,
        dealerIds: (draft.days[item] ?? []).map((stop) => stop.dealerId),
      })),
      note: draft.note,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Kiểm tra lại tuyến');
      return;
    }
    setSaving(true);
    setError(null);
    const result = await submitMyRoute(parsed.data);
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    clearRouteDraft(periodKey(period));
    onDone(result.data);
  }

  return (
    <View style={styles.fill}>
      <BackBar title={period.periodLabel} onBack={onCancel} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {period.plan?.approved ? (
          <Text style={styles.notice}>
            Bản sửa phải được duyệt lại. Trong lúc chờ, tuyến đã duyệt vẫn có hiệu lực.
          </Text>
        ) : null}
        {period.pastDeadline ? (
          <Text style={styles.notice}>
            Đã qua hạn nộp {when(period.deadline)}. Vẫn gửi được, phiếu gắn nhãn Nộp muộn.
          </Text>
        ) : null}
        {period.days.length > 1 ? (
          <View style={styles.chips}>
            {period.days.map((item) => {
              const count = draft.days[item]?.length ?? 0;
              const selected = item === day;
              return (
                <Pressable
                  key={item}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    setDay(item);
                    setError(null);
                  }}
                  style={[styles.chip, selected ? styles.chipActive : null]}
                >
                  <Text style={[styles.chipText, selected ? styles.chipTextActive : null]}>
                    {formatRouteDayShort(item)} ({count})
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <Text style={styles.section}>{formatRouteDay(day)}</Text>
        {stops.length === 0 ? (
          <Text style={styles.muted}>Chưa có điểm. Bấm Thêm đại lý.</Text>
        ) : (
          stops.map((stop, index) => (
            <View key={stop.dealerId} style={styles.stop}>
              <Text style={styles.index}>{index + 1}</Text>
              <View style={styles.flex}>
                <Text style={styles.name}>{stop.dealerName}</Text>
                <Text style={styles.muted} numberOfLines={1}>
                  {stop.address}
                  {stop.lat === null ? ', chưa có toạ độ' : ''}
                </Text>
              </View>
              <SmallButton label="Lên" onPress={() => move(index, -1)} />
              <SmallButton label="Xuống" onPress={() => move(index, 1)} />
              <SmallButton label="Bỏ" onPress={() => update(stops.filter((_, i) => i !== index))} />
            </View>
          ))
        )}
        <View style={styles.actions}>
          <Button
            label={adding ? 'Đóng tìm đại lý' : 'Thêm đại lý'}
            onPress={() => setAdding((value) => !value)}
            variant="ghost"
          />
          {stops.length > 1 ? (
            <Button
              label="Sắp theo đường gần nhất"
              onPress={() => void sortNearest()}
              variant="ghost"
            />
          ) : null}
        </View>
        {adding ? (
          <View style={styles.search}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Tìm đại lý theo tên, mã, số điện thoại"
              accessibilityLabel="Tìm đại lý để thêm vào tuyến"
              style={styles.input}
              autoCorrect={false}
            />
            <DealerResults search={search} limit={VISIBLE_RESULTS} onPick={add} />
          </View>
        ) : null}

        <View style={styles.field}>
          <Text style={styles.muted}>Ghi chú cho người duyệt (không bắt buộc)</Text>
          <TextInput
            value={draft.note}
            onChangeText={(note) => setDraft((current) => ({ ...current, note }))}
            maxLength={500}
            accessibilityLabel="Ghi chú"
            style={styles.input}
          />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.actions}>
          {saving ? (
            <ActivityIndicator color={COLORS.brand} />
          ) : (
            <Button label="Gửi duyệt" onPress={() => void submit()} />
          )}
          <Button label="Lưu nháp" onPress={saveDraft} variant="ghost" />
        </View>
      </ScrollView>
    </View>
  );
}

function SmallButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.small}
    >
      <Text style={styles.smallText}>{label}</Text>
    </Pressable>
  );
}

function PeriodCard({
  period,
  onEdit,
  onChange,
}: {
  period: MyRoutePeriod;
  onEdit: () => void;
  onChange: (data: MyRoutesResult) => void;
}) {
  const plan = period.plan;
  const pending =
    plan?.approvalStatus != null && PENDING_APPROVAL_STATUSES.includes(plan.approvalStatus);
  const days = plan?.approved && pending ? plan.approved : (plan?.proposed ?? []);
  const hasDraft = getRouteDraft(periodKey(period)) !== null;

  function confirmWithdraw(code: string) {
    Alert.alert('Rút lại phiếu', `Rút lại phiếu ${code}? Bạn sửa rồi gửi lại khi cần.`, [
      { text: 'Không', style: 'cancel' },
      {
        text: 'Rút lại',
        style: 'destructive',
        onPress: () => {
          void withdrawRoute(code).then((result) => {
            if (result.ok) onChange(result.data);
            else Alert.alert('Chưa rút lại được', result.message);
          });
        },
      },
    ]);
  }

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.cardTitle}>{period.periodLabel}</Text>
        {plan?.approvalStatus ? <StatusTag status={plan.approvalStatus} /> : null}
        {plan?.isLate ? <Text style={styles.late}>Nộp muộn</Text> : null}
      </View>
      <Text style={styles.muted}>
        {period.editable
          ? `Hạn nộp ${when(period.deadline)}${period.pastDeadline ? ', đã qua hạn' : ''}`
          : 'Kỳ đã qua, chỉ xem'}
        {plan?.approvalCode ? `. Phiếu ${plan.approvalCode}` : ''}
      </Text>
      {plan?.returnReason ? (
        <Text style={styles.returned}>Lý do trả lại: {plan.returnReason}</Text>
      ) : null}
      {plan?.approved && pending ? (
        <Text style={styles.muted}>Bản sửa đang chờ duyệt, tuyến đã duyệt vẫn có hiệu lực:</Text>
      ) : null}
      {plan?.completion && plan.completion.planned > 0 ? (
        <Text style={styles.body}>
          Đã ghé {plan.completion.visited} trên {plan.completion.planned} điểm tới hôm nay
        </Text>
      ) : null}
      {days
        .filter((day) => day.stops.length > 0)
        .map((day) => (
          <Text key={day.day} style={styles.body} numberOfLines={2}>
            {day.label}: {day.stops.map((stop) => stop.dealerName).join(', ')}
          </Text>
        ))}
      {!plan ? (
        <Text style={styles.muted}>
          {hasDraft ? 'Có nháp trên máy, chưa gửi.' : 'Chưa đăng ký tuyến kỳ này.'}
        </Text>
      ) : null}
      {period.editable ? (
        <View style={styles.actions}>
          {pending ? null : (
            <Button
              label={plan ? 'Sửa tuyến' : 'Đăng ký tuyến'}
              onPress={onEdit}
              variant={plan ? 'ghost' : 'primary'}
            />
          )}
          {plan?.canWithdraw && plan.approvalCode ? (
            <Button
              label="Rút lại phiếu"
              onPress={() => confirmWithdraw(plan.approvalCode ?? '')}
              variant="ghost"
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** Màn Tuyến của tôi (S8): đăng ký tuần này và tuần sau, hoặc hôm nay tới 7 ngày tới; kỳ qua chỉ xem. */
export function RoutesScreen({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<MyRoutesResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<MyRoutePeriod | null>(null);

  const reload = useCallback(async () => {
    const result = await loadMyRoutes();
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

  if (editing) {
    return (
      <RouteEditor
        period={editing}
        onCancel={() => setEditing(null)}
        onDone={(next) => {
          setEditing(null);
          setData(next);
        }}
      />
    );
  }

  return (
    <View style={styles.fill}>
      <BackBar title="Tuyến của tôi" onBack={onClose} />
      <ScrollView contentContainerStyle={styles.content}>
        {data ? (
          <Text style={styles.muted}>
            Đơn vị của bạn đăng ký tuyến {ROUTE_KIND_LABEL[data.kind].toLowerCase()}.
            {data.canRegister ? '' : ' Tài khoản chưa được cấp quyền đăng ký tuyến.'}
          </Text>
        ) : null}
        {error ? (
          <View style={styles.card}>
            <Text style={styles.error}>{error}</Text>
            <Button label="Thử lại" onPress={() => void reload()} variant="ghost" />
          </View>
        ) : null}
        {data === null && !error ? <ActivityIndicator color={COLORS.brand} /> : null}
        {data?.periods.map((period) => (
          <PeriodCard
            key={periodKey(period)}
            period={period}
            onEdit={() => setEditing(period)}
            onChange={setData}
          />
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
  head: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, flexWrap: 'wrap' },
  cardTitle: { fontSize: 16, fontWeight: FONT.bold, color: COLORS.brand },
  section: { fontSize: 16, fontWeight: FONT.bold, color: COLORS.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.xs },
  chip: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: SPACE.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.brandSoft, borderColor: COLORS.brand },
  chipText: { fontSize: 14, color: COLORS.text },
  chipTextActive: { color: COLORS.brand, fontWeight: FONT.bold },
  stop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xs,
    paddingVertical: SPACE.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  index: { minWidth: 22, fontSize: 15, fontWeight: FONT.bold, color: COLORS.textMuted },
  flex: { flex: 1 },
  name: { fontSize: 15, fontWeight: FONT.bold, color: COLORS.text },
  small: {
    minHeight: 40,
    minWidth: 44,
    paddingHorizontal: SPACE.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  smallText: { fontSize: 13, color: COLORS.brand, fontWeight: FONT.bold },
  search: { gap: SPACE.sm },
  field: { gap: SPACE.xs },
  input: {
    minHeight: 48,
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
  late: {
    backgroundColor: COLORS.warningSoft,
    borderRadius: 4,
    paddingHorizontal: 6,
    fontSize: 13,
    color: COLORS.text,
    overflow: 'hidden',
  },
  body: { fontSize: 14, color: COLORS.text },
  muted: { fontSize: 14, color: COLORS.textMuted },
  error: { fontSize: 14, color: COLORS.danger },
});
