import { StyleSheet, View } from 'react-native';
import { APPROVAL_STATUS_LABEL, type ApprovalStatus } from '@seedgw/contracts/approvals';
import {
  targetPercent,
  type ApprovedTargetValues,
  type MyTargetMonth,
  type SalesTargetSnapshot,
  type TargetProgress,
} from '@seedgw/contracts/sales-targets';
import { FEATURES } from '@seedgw/contracts/features';
import { COLORS, FONT, SPACE } from '../theme';
import { Text } from './text';

/** Nhóm 3 chữ số bằng dấu chấm, không dùng Intl để chạy giống nhau trên mọi máy. */
export function groupDigits(value: number): string {
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

const STATUS_TONE: Record<ApprovalStatus, { backgroundColor: string; color: string }> = {
  DRAFT: { backgroundColor: COLORS.surfaceSubtle, color: COLORS.textMuted },
  PENDING_MANAGER: { backgroundColor: COLORS.warningSoft, color: COLORS.text },
  PENDING_LEADER: { backgroundColor: COLORS.warningSoft, color: COLORS.text },
  RETURNED: { backgroundColor: COLORS.dangerSoft, color: COLORS.danger },
  APPROVED: { backgroundColor: COLORS.brandSoft, color: COLORS.brand },
  WITHDRAWN: { backgroundColor: COLORS.surfaceSubtle, color: COLORS.textMuted },
};

export function StatusTag({ status }: { status: ApprovalStatus }) {
  const tone = STATUS_TONE[status];
  return (
    <Text style={[styles.tag, { backgroundColor: tone.backgroundColor, color: tone.color }]}>
      {APPROVAL_STATUS_LABEL[status]}
    </Text>
  );
}

/** Một dòng tiến độ: thực tế trên chỉ tiêu đang hiệu lực, kèm thanh %. */
export function ProgressRow({
  label,
  actual,
  target,
  unit,
}: {
  label: string;
  actual: number;
  target: number | null;
  unit: string;
}) {
  const percent = targetPercent(actual, target);
  return (
    <View style={styles.row}>
      <View style={styles.rowHead}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>
          {groupDigits(actual)}
          {target === null ? '' : ` / ${groupDigits(target)}`} {unit}
          {percent === null ? '' : `, ${percent}%`}
        </Text>
      </View>
      {percent === null ? null : (
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.min(percent, 100)}%` }]} />
        </View>
      )}
    </View>
  );
}

/** Ba chỉ tiêu: bản đề nghị, bản đang hiệu lực, thực tế trong tháng. */
export function TargetValues({
  proposed,
  approved,
  progress,
}: {
  proposed: SalesTargetSnapshot;
  approved: ApprovedTargetValues | null;
  progress: TargetProgress;
}) {
  const changed =
    approved !== null &&
    (approved.visitCountTarget !== proposed.visitCountTarget ||
      approved.dealerCoverageTarget !== proposed.dealerCoverageTarget ||
      approved.salesKgTarget !== proposed.salesKgTarget);
  return (
    <View style={styles.values}>
      <ProgressRow
        label="Lượt ghé thăm"
        actual={progress.visitCount}
        target={approved?.visitCountTarget ?? null}
        unit="lượt"
      />
      <ProgressRow
        label="Số đại lý được ghé"
        actual={progress.dealerCoverage}
        target={approved?.dealerCoverageTarget ?? null}
        unit="đại lý"
      />
      {FEATURES.sales ? (
        <Text style={styles.muted}>
          Thực bán:{' '}
          {approved ? `${groupDigits(approved.salesKgTarget)} kg, có % khi nối FAST` : 'chưa có'}
        </Text>
      ) : null}
      {approved === null || changed ? (
        <Text style={styles.muted}>
          {approved === null ? 'Đề nghị' : 'Bản sửa đề nghị'}:{' '}
          {groupDigits(proposed.visitCountTarget)} lượt,{' '}
          {groupDigits(proposed.dealerCoverageTarget)} đại lý
          {FEATURES.sales ? `, ${groupDigits(proposed.salesKgTarget)} kg` : ''}
        </Text>
      ) : null}
    </View>
  );
}

/** K3: chỉ tiêu được giao thay chỉ tiêu tự đăng ký của tháng đó. */
export function AssignedValues({
  assigned,
  progress,
}: {
  assigned: NonNullable<MyTargetMonth['assigned']>;
  progress: TargetProgress;
}) {
  return (
    <View style={styles.values}>
      <ProgressRow
        label="Lượt ghé thăm"
        actual={progress.visitCount}
        target={assigned.visitCountTarget}
        unit="lượt"
      />
      <ProgressRow
        label="Số đại lý được ghé"
        actual={progress.dealerCoverage}
        target={assigned.dealerCoverageTarget}
        unit="đại lý"
      />
      <Text style={styles.muted}>
        {`Chỉ tiêu được giao bởi ${assigned.assignedByName}${assigned.note ? `. ${assigned.note}` : ''}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    alignSelf: 'flex-start',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
    fontSize: 13,
    fontWeight: FONT.bold,
    overflow: 'hidden',
  },
  values: { gap: SPACE.sm },
  row: { gap: SPACE.xs },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACE.sm },
  label: { fontSize: 14, color: COLORS.textMuted, flexShrink: 1 },
  value: { fontSize: 15, fontWeight: FONT.bold, color: COLORS.text },
  track: { height: 6, borderRadius: 3, backgroundColor: COLORS.surfaceSubtle, overflow: 'hidden' },
  fill: { height: 6, backgroundColor: COLORS.brand },
  muted: { fontSize: 14, color: COLORS.textMuted },
});
