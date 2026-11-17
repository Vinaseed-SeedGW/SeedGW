'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { isoDateToDisplay } from '@dms/contracts/format';

type Props = { data: { day: string; visits: number }[] };

/** Lượt ghé thăm theo ngày. Màu lấy từ token biểu đồ (BRAND.md), không viết mã màu trực tiếp. */
export function VisitsChart({ data }: Props) {
  const rows = data.map((row) => ({ ...row, label: isoDateToDisplay(row.day).slice(0, 5) }));
  return (
    <div
      className="h-64 w-full"
      role="img"
      aria-label={`Biểu đồ lượt ghé thăm theo ngày, ${data.length} ngày`}
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
            labelFormatter={(label) => `Ngày ${String(label)}`}
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
