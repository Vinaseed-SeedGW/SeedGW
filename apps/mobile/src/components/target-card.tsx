import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { currentVnMonth, type MyTargetMonth } from '@dms/contracts/sales-targets';
import { loadMyTargets } from '../api/targets';
import { COLORS, FONT, SPACE } from '../theme';
import { Button } from './button';
import { StatusTag, TargetValues } from './target-figures';
import { Text } from './text';

/** Thẻ chỉ tiêu tháng này ở tab Hôm nay (K3a). Mất mạng thì ẩn, không ảnh hưởng check-in. */
export function TargetCard({ refreshKey, onOpen }: { refreshKey: number; onOpen: () => void }) {
  const [month, setMonth] = useState<MyTargetMonth | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadMyTargets().then((result) => {
      if (cancelled || !result.ok) return;
      const current = currentVnMonth();
      setMonth(result.data.months.find((item) => item.month === current) ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (!month) return null;
  const target = month.target;
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>Chỉ tiêu {month.monthLabel.toLowerCase()}</Text>
        {target?.approvalStatus && target.approvalStatus !== 'APPROVED' ? (
          <StatusTag status={target.approvalStatus} />
        ) : null}
      </View>
      {target ? (
        <TargetValues
          proposed={target.proposed}
          approved={target.approved}
          progress={month.progress}
        />
      ) : (
        <Text style={styles.muted}>
          Chưa đăng ký chỉ tiêu tháng này. Đã ghé {month.progress.visitCount} lượt,{' '}
          {month.progress.dealerCoverage} đại lý.
        </Text>
      )}
      <View style={styles.actions}>
        <Button
          label={target || !month.editable ? 'Xem chỉ tiêu' : 'Đăng ký chỉ tiêu'}
          onPress={onOpen}
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
  head: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, flexWrap: 'wrap' },
  title: { fontSize: 14, color: COLORS.textMuted, fontWeight: FONT.bold },
  muted: { fontSize: 14, color: COLORS.textMuted },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
});
