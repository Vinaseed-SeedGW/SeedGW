import { useEffect, useMemo, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import {
  mapsDirectionLinks,
  type MyRoutesResult,
  type RouteStopView,
} from '@dms/contracts/route-plans';
import type { DealerChoice } from '../api/dealers';
import { loadMyRoutes } from '../api/routes';
import { startOfVnDay } from '../sync/geo';
import { readLocalHistory } from '../sync/track-db';
import { COLORS, FONT, SPACE } from '../theme';
import { Button } from './button';
import { Text } from './text';

const DAY_MS = 86_400_000;

/** Đại lý đã check-in hôm nay trên máy, để đánh dấu Đã ghé ngay cả khi chưa gửi lên máy chủ. */
export function useLocalVisited(refreshKey: number): ReadonlySet<string> {
  return useMemo(() => {
    void refreshKey;
    const dayStart = startOfVnDay(Date.now());
    return new Set(
      readLocalHistory(dayStart, dayStart + DAY_MS).flatMap((row) =>
        row.dealerId ? [row.dealerId] : [],
      ),
    );
  }, [refreshKey]);
}

/** Tuyến của tôi từ máy chủ; mất mạng thì null, không chặn check-in. */
export function useMyRoutes(refreshKey: number, enabled: boolean) {
  const [data, setData] = useState<MyRoutesResult | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void loadMyRoutes().then((result) => {
      if (!cancelled && result.ok) setData(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshKey, enabled]);
  return data;
}

export function toDealerChoice(stop: RouteStopView): DealerChoice {
  return { id: stop.dealerId, name: stop.dealerName, lat: stop.lat, lng: stop.lng };
}

/** Tuyến đã duyệt hôm nay ở đầu tab Tuyến: điểm theo thứ tự, Đã ghé, Check-in, Chỉ đường Google Maps. */
export function TodayRouteSection({
  routes,
  visited,
  onPick,
  onOpenRoutes,
}: {
  routes: MyRoutesResult | null;
  visited: ReadonlySet<string>;
  onPick: (dealer: DealerChoice) => void;
  onOpenRoutes: () => void;
}) {
  const today = routes?.today ?? null;
  const links = today ? mapsDirectionLinks(today.stops) : [];
  const done = today
    ? today.stops.filter((stop) => stop.visited || visited.has(stop.dealerId)).length
    : 0;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Tuyến hôm nay</Text>
      {today ? (
        <>
          <Text style={styles.muted}>
            {today.label}, đã ghé {done} trên {today.stops.length} điểm
            {today.approvalCode ? `, phiếu ${today.approvalCode}` : ''}
          </Text>
          {today.stops.map((stop, index) => {
            const isVisited = stop.visited || visited.has(stop.dealerId);
            return (
              <View key={stop.dealerId} style={styles.stop}>
                <Text style={styles.index}>{index + 1}</Text>
                <View style={styles.flex}>
                  <Text style={styles.name}>
                    {stop.dealerName}
                    {isVisited ? <Text style={styles.visited}> Đã ghé</Text> : null}
                  </Text>
                  <Text style={styles.muted} numberOfLines={2}>
                    {stop.address}
                    {stop.lat === null ? ', chưa có toạ độ' : ''}
                  </Text>
                </View>
                {isVisited ? null : (
                  <Button
                    label="Check-in"
                    onPress={() => onPick(toDealerChoice(stop))}
                    variant="ghost"
                  />
                )}
              </View>
            );
          })}
          <View style={styles.actions}>
            {links.map((link) => (
              <Button
                key={link.from}
                label={
                  links.length > 1 ? `Chỉ đường điểm ${link.from} đến ${link.to}` : 'Chỉ đường'
                }
                onPress={() => void Linking.openURL(link.url)}
              />
            ))}
          </View>
          <Text style={styles.muted}>
            Chỉ đường mở Google Maps theo đúng thứ tự, đi từ vị trí hiện tại. Check-in ngoài tuyến
            vẫn được ghi nhận.
          </Text>
        </>
      ) : (
        <Text style={styles.muted}>
          {routes === null
            ? 'Chưa tải được tuyến, kiểm tra mạng.'
            : 'Hôm nay chưa có tuyến đã duyệt.'}
        </Text>
      )}
      <View style={styles.actions}>
        <Button
          label={routes?.canRegister ? 'Đăng ký, xem tuyến' : 'Xem tuyến'}
          onPress={onOpenRoutes}
          variant="ghost"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: SPACE.md,
    gap: SPACE.sm,
  },
  title: { fontSize: 20, fontWeight: FONT.bold, color: COLORS.brand },
  stop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    paddingVertical: SPACE.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  index: { width: 24, fontSize: 15, fontWeight: FONT.bold, color: COLORS.textMuted },
  flex: { flex: 1 },
  name: { fontSize: 15, fontWeight: FONT.bold, color: COLORS.text },
  visited: { fontSize: 13, color: COLORS.brand, fontWeight: FONT.bold },
  muted: { fontSize: 14, color: COLORS.textMuted },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
});
