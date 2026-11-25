import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { currentVnMonth, targetPercent, type MyTargetMonth } from '@seedgw/contracts/sales-targets';
import { loadMyTargets } from '../api/targets';
import { COLORS, FONT, SPACE } from '../theme';
import { Text } from './text';

/**
 * Một dòng chỉ tiêu tháng ở tab Hôm nay (app tinh gọn 25/11): biết mình đang ở đâu là đủ. Đăng ký, sửa chỉ
 * tiêu làm trên web. Mất mạng thì ẩn, không ảnh hưởng check-in.
 */
export function TargetCard({ refreshKey }: { refreshKey: number }) {
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
  // Chỉ tiêu được giao là chính; chưa giao thì lấy chỉ tiêu tự đăng ký đã duyệt.
  const goal = month.assigned ?? month.target?.approved ?? null;
  const visits = month.progress.visitCount;
  const dealers = month.progress.dealerCoverage;
  const visitPercent = targetPercent(visits, goal?.visitCountTarget);
  const dealerPercent = targetPercent(dealers, goal?.dealerCoverageTarget);

  return (
    <View style={styles.line} accessibilityRole="summary">
      <Text style={styles.title}>Chỉ tiêu {month.monthLabel.toLowerCase()}</Text>
      {goal ? (
        <Text style={styles.body}>
          {`${visits} trên ${goal.visitCountTarget} lượt${visitPercent !== null ? ` (${visitPercent}%)` : ''}, ${dealers} trên ${goal.dealerCoverageTarget} đại lý${dealerPercent !== null ? ` (${dealerPercent}%)` : ''}`}
        </Text>
      ) : (
        <Text
          style={styles.body}
        >{`Chưa có chỉ tiêu. Đã ghé ${visits} lượt, ${dealers} đại lý.`}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  line: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.brand,
    backgroundColor: COLORS.brandSoft,
    borderRadius: 8,
    paddingVertical: SPACE.sm,
    paddingHorizontal: SPACE.md,
    gap: 2,
  },
  title: { fontSize: 14, fontWeight: FONT.bold, color: COLORS.brand },
  body: { fontSize: 16, color: COLORS.text },
});
