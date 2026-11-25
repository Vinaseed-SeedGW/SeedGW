import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  DEALER_PROPOSAL_STATUS_LABEL,
  type DealerProposalStatus,
  type MyDealerProposal,
} from '@seedgw/contracts/dealer-proposals';
import { formatDateTime } from '@seedgw/contracts/format';
import { loadMyDealerProposals } from '../api/dealer-proposals';
import { COLORS, FONT, SPACE } from '../theme';
import { Button } from './button';
import { Text } from './text';

// Tab Tuyến (M10): nút Thêm đại lý và các đề xuất gần đây của tôi. Đề xuất chưa gửi nằm trong hàng chờ
// check-in, hiện ở tab Hôm nay và Lịch sử như lượt Chờ gửi.

const VISIBLE = 5;

const STATUS_STYLE: Record<DealerProposalStatus, { backgroundColor: string }> = {
  PENDING: { backgroundColor: COLORS.warningSoft },
  APPROVED: { backgroundColor: COLORS.brandSoft },
  REJECTED: { backgroundColor: COLORS.dangerSoft },
  DUPLICATE: { backgroundColor: COLORS.brandSoft },
};

type Loaded = { items: MyDealerProposal[] } | { error: string } | null;

function ProposalItem({ item }: { item: MyDealerProposal }) {
  return (
    <View style={styles.item}>
      <View style={styles.itemHead}>
        <Text style={[styles.name, styles.flex]}>{item.name}</Text>
        <Text style={[styles.status, STATUS_STYLE[item.status]]}>
          {DEALER_PROPOSAL_STATUS_LABEL[item.status]}
        </Text>
      </View>
      <Text style={styles.muted}>{formatDateTime(item.capturedAt)}</Text>
      {item.status === 'DUPLICATE' && item.dealerName ? (
        <Text style={styles.muted}>{`Đã có trong danh mục: ${item.dealerName}`}</Text>
      ) : null}
      {item.reviewNote ? <Text style={styles.note}>{item.reviewNote}</Text> : null}
    </View>
  );
}

export function MyDealerProposals({
  onAdd,
  refreshKey,
}: {
  onAdd: () => void;
  refreshKey: number;
}) {
  const [loaded, setLoaded] = useState<Loaded>(null);

  useEffect(() => {
    let cancelled = false;
    void loadMyDealerProposals().then((result) => {
      if (cancelled) return;
      setLoaded(result.ok ? { items: result.data.items } : { error: result.message });
    });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return (
    <View style={styles.section}>
      <Text style={styles.title}>Đại lý mới</Text>
      <Text style={styles.muted}>
        Cửa hàng chưa có trong danh mục: chụp ảnh tại chỗ và điền thông tin để Quản trị đơn vị
        duyệt.
      </Text>
      <Button label="Thêm đại lý" onPress={onAdd} />
      {loaded && 'error' in loaded ? (
        <Text style={styles.muted}>{`Chưa tải được đề xuất của tôi: ${loaded.error}`}</Text>
      ) : null}
      {loaded && 'items' in loaded && loaded.items.length > 0 ? (
        <>
          <Text style={styles.subtitle}>Đại lý tôi đề xuất</Text>
          {loaded.items.slice(0, VISIBLE).map((item) => (
            <ProposalItem key={item.id} item={item} />
          ))}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: SPACE.sm, marginBottom: SPACE.md },
  title: { fontSize: 20, fontWeight: FONT.bold, color: COLORS.brand },
  subtitle: { fontSize: 16, fontWeight: FONT.bold, color: COLORS.text, marginTop: SPACE.sm },
  muted: { fontSize: 14, color: COLORS.textMuted },
  note: { fontSize: 14, color: COLORS.text },
  item: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: SPACE.md,
    gap: 2,
  },
  itemHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: SPACE.sm },
  flex: { flex: 1 },
  name: { fontSize: 16, fontWeight: FONT.bold, color: COLORS.text },
  status: {
    fontSize: 13,
    color: COLORS.text,
    paddingHorizontal: SPACE.sm,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
});
