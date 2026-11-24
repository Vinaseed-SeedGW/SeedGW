'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { bucketLabel, type ChartBucket } from '@seedgw/contracts/dashboard';

type Props = { data: { start: string; visits: number }[]; bucket: ChartBucket };

const UNIT: Record<ChartBucket, string> = { day: 'ngày', week: 'tuần', month: 'tháng' };
const TOOLTIP_PREFIX: Record<ChartBucket, string> = {
  day: 'Ngày',
  week: 'Tuần từ',
  month: 'Tháng',
};

/**
 * Lượt ghé thăm theo ngày, tuần hoặc tháng (K4c). Màu lấy từ token biểu đồ (BRAND.md), không viết mã màu
 * trực tiếp.
 */
export function VisitsChart({ data, bucket }: Props) {
  const rows = data.map((row) => ({ ...row, label: bucketLabel(row.start, bucket) }));
  return (
    <div
      className="h-64 w-full"
      role="img"
      aria-label={`Biểu đồ lượt ghé thăm theo ${UNIT[bucket]}, ${data.length} ${UNIT[bucket]}`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
            tickLine={false}
            axisLine={{ stroke: 'var(--border)' }}
            interval="preserveStartEnd"
            minTickGap={12}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ fill: 'var(--brand-soft)' }}
            formatter={(value) => [String(value), 'Lượt ghé thăm']}
            labelFormatter={(label) => `${TOOLTIP_PREFIX[bucket]} ${String(label)}`}
            contentStyle={{
              borderRadius: 6,
              borderColor: 'var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
            }}
          />
          <Bar dataKey="visits" fill="var(--chart-1)" radius={[3, 3, 0, 0]} maxBarSize={32} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
