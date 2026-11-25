import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import * as Location from 'expo-location';
import type { MobileDealerOption } from '@seedgw/contracts/dealers';
import { searchDealers, type DealerChoice } from '../api/dealers';
import { formatKm, formatVnDate, formatVnTime, startOfVnDay } from '../sync/geo';
import { computeDayStats, getOpenSession, readLocalHistory } from '../sync/track-db';
import { COLORS, FONT, SPACE } from '../theme';
import { SUPPORT_FAB_CLEARANCE } from './support-fab';
import { Button } from './button';
import { distanceText, toChoice } from './dealer-picker';
import { TargetCard } from './target-card';
import { TodayRouteSection, useMyRoutes } from './today-route';
import { Text } from './text';
import type { SyncControl } from './use-sync';
import type { TrackingControl } from './use-tracking';

const REFRESH_MS = 5_000;
const DAY_MS = 86_400_000;

type Today = {
  checkIns: number;
  gpsMeters: number;
  sessionStartedAt: number | null;
  visitedDealerIds: ReadonlySet<string>;
};

function readToday(): Today {
  const dayStart = startOfVnDay(Date.now());
  const rows = readLocalHistory(dayStart, dayStart + DAY_MS);
  return {
    checkIns: rows.length,
    gpsMeters: computeDayStats(dayStart).gpsDistanceM,
    sessionStartedAt: getOpenSession()?.started_at ?? null,
    visitedDealerIds: new Set(rows.flatMap((row) => (row.dealerId ? [row.dealerId] : []))),
  };
}

/**
 * Đại lý gần nhất trong phạm vi của tôi mà hôm nay chưa ghé. Tạm thay "Điểm cần thăm" tới khi có tuyến
 * đã duyệt (S8). Chỉ tính đại lý đã có toạ độ; mất mạng hoặc chưa có vị trí thì không hiện.
 */
function useNextDealer(visited: ReadonlySet<string>, enabled: boolean) {
  const [dealer, setDealer] = useState<MobileDealerOption | null>(null);
  const visitedKey = [...visited].sort().join(',');

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void (async () => {
      try {
        const last = await Location.getLastKnownPositionAsync();
        if (!last) return;
        const result = await searchDealers('', {
          lat: last.coords.latitude,
          lng: last.coords.longitude,
        });
        if (cancelled || !result.ok) return;
        const skip = new Set(visitedKey.split(','));
        setDealer(
          result.items.find((item) => item.distanceM !== null && !skip.has(item.id)) ?? null,
        );
      } catch {
        // Không lấy được vị trí: bỏ qua mục này, không ảnh hưởng check-in.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visitedKey, enabled]);

  return dealer;
}

type Props = {
  control: TrackingControl;
  sync: SyncControl | null;
  onOpenCamera: () => void;
  onPickDealer: (dealer: DealerChoice) => void;
  onOpenRoute: (() => void) | null;
  /** Có khi đã đăng nhập máy chủ: mở màn Chỉ tiêu của tôi (K3a). */
  showTarget: boolean;
  /** Mở Hỗ trợ điền sẵn báo lỗi gửi dữ liệu (T3). */
  onReportProblem: ((detail: string) => void) | null;
  refreshKey: number;
};

/** Tab Hôm nay (IA): việc chính khi đi thị trường, trạng thái ghi hành trình và dữ liệu chờ gửi. */
export function TodayTab({
  control,
  sync,
  onOpenCamera,
  onPickDealer,
  onOpenRoute,
  showTarget,
  onReportProblem,
  refreshKey,
}: Props) {
  const { state, actions } = control;
  const [today, setToday] = useState<Today>(readToday);
  const reload = useCallback(() => setToday(readToday()), []);
  // Có tuyến đã duyệt hôm nay thì Điểm cần thăm là điểm kế tiếp chưa ghé trong tuyến (S8).
  const routes = useMyRoutes(refreshKey, sync !== null);
  const routeStops = routes?.today?.stops ?? [];
  const next = useNextDealer(today.visitedDealerIds, sync !== null && routeStops.length === 0);

  useEffect(() => {
    const timer = setInterval(reload, REFRESH_MS);
    return () => clearInterval(timer);
  }, [reload]);
  useEffect(reload, [state.tracking, reload]);

  const pending = sync?.state.pending;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.date}>{formatVnDate(Date.now())}</Text>

      <View style={styles.actions}>
        <Button label="Chụp ảnh check-in" onPress={onOpenCamera} />
        {onOpenRoute ? (
          <Button label="Đại lý gần tôi" onPress={onOpenRoute} variant="ghost" />
        ) : null}
      </View>

      <View style={[styles.status, state.tracking ? styles.statusOn : styles.statusOff]}>
        <View style={styles.statusHead}>
          <View style={styles.statusText}>
            <Text style={styles.statusTitle}>
              {state.tracking ? 'Đang ghi hành trình' : 'Chưa ghi hành trình'}
            </Text>
            {today.sessionStartedAt !== null ? (
              <Text style={styles.muted}>
                Bắt đầu lúc {formatVnTime(today.sessionStartedAt).slice(0, 5)}
              </Text>
            ) : null}
          </View>
          {state.tracking ? (
            <Button label="Kết thúc ngày" onPress={() => void actions.stop()} variant="ghost" />
          ) : (
            <Button label="Bắt đầu ghi" onPress={() => void actions.start()} variant="ghost" />
          )}
        </View>
        {state.tracking ? (
          <Text style={styles.muted}>
            Khoá màn hình hoặc chuyển app thoải mái. Đừng vuốt tắt app, hành trình sẽ bị đứt.
          </Text>
        ) : (
          <Text style={styles.muted}>Lượt check-in đầu tiên trong ngày tự bật ghi hành trình.</Text>
        )}
        <View style={styles.figures}>
          <Figure value={String(today.checkIns)} label="lượt check-in" />
          <Figure value={formatKm(today.gpsMeters)} label="km theo GPS" />
        </View>
      </View>
      {state.message ? <Text style={styles.error}>{state.message}</Text> : null}

      {showTarget ? <TargetCard refreshKey={refreshKey} /> : null}

      {routeStops.length > 0 ? (
        <TodayRouteSection routes={routes} visited={today.visitedDealerIds} onPick={onPickDealer} />
      ) : next ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Đại lý gần nhất chưa ghé hôm nay</Text>
          <Text style={styles.dealerName}>{next.name}</Text>
          <Text style={styles.muted} numberOfLines={2}>
            {distanceText(next.distanceM)}, {next.address}
          </Text>
          <View style={styles.actions}>
            <Button label="Check-in đại lý này" onPress={() => onPickDealer(toChoice(next))} />
          </View>
        </View>
      ) : null}

      {sync && pending ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Gửi lên máy chủ</Text>
          <Text style={styles.body}>
            {sync.state.syncing
              ? 'Đang gửi lên máy chủ'
              : pending.checkIns === 0 && pending.points === 0
                ? 'Đã gửi hết'
                : `Chờ gửi: ${pending.checkIns} check-in, ${pending.points} điểm GPS`}
          </Text>
          {pending.failedCheckIns > 0 ? (
            <Text style={styles.error}>{pending.failedCheckIns} check-in máy chủ không nhận.</Text>
          ) : null}
          {onReportProblem && (pending.failedCheckIns > 0 || sync.state.lastError) ? (
            <View style={styles.actions}>
              <Button
                label="Báo lỗi này"
                variant="ghost"
                onPress={() =>
                  onReportProblem(
                    [
                      pending.failedCheckIns > 0
                        ? `${pending.failedCheckIns} check-in máy chủ không nhận.`
                        : '',
                      sync.state.lastError ? `Lần gửi gần nhất: ${sync.state.lastError}` : '',
                      `Chờ gửi: ${pending.checkIns} check-in, ${pending.points} điểm GPS.`,
                    ]
                      .filter(Boolean)
                      .join(' '),
                  )
                }
              />
            </View>
          ) : null}
          {sync.state.lastError ? (
            <Text style={styles.muted}>Lần gửi gần nhất: {sync.state.lastError}</Text>
          ) : null}
          <View style={styles.actions}>
            <Button label="Gửi ngay" onPress={() => void sync.actions.syncNow()} variant="ghost" />
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.figure}>
      <Text style={styles.figureValue}>{value}</Text>
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: SPACE.lg, gap: SPACE.md, paddingBottom: SUPPORT_FAB_CLEARANCE },
  date: { fontSize: 15, color: COLORS.textMuted },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
  status: { borderRadius: 8, padding: SPACE.md, gap: SPACE.sm },
  statusOn: { backgroundColor: COLORS.brandSoft },
  statusOff: { backgroundColor: COLORS.surfaceSubtle },
  statusHead: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  statusText: { flex: 1, gap: 2 },
  statusTitle: { fontSize: 17, fontWeight: FONT.bold, color: COLORS.text },
  figures: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.lg },
  figure: { gap: 0 },
  figureValue: { fontSize: 22, fontWeight: FONT.bold, color: COLORS.brand },
  card: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: SPACE.md,
    gap: SPACE.xs,
  },
  cardTitle: { fontSize: 14, color: COLORS.textMuted },
  dealerName: { fontSize: 17, fontWeight: FONT.bold, color: COLORS.text },
  body: { fontSize: 15, color: COLORS.text },
  muted: { fontSize: 14, color: COLORS.textMuted },
  error: { fontSize: 14, color: COLORS.danger },
});
