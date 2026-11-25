import type { Metadata } from 'next';
import { formatNumber, isoDateToDisplay } from '@seedgw/contracts/format';
import {
  SUPPORT_STATS_MAX_DAYS,
  supportStatsUrlParams,
  type SupportStatsGroup,
} from '@seedgw/contracts/support';
import { DateRangeFilter } from '@/features/shell/components/date-range-filter';
import { SupportInboxTabs } from '@/features/support/components/support-inbox-tabs';
import { requirePermission } from '@/server/auth/can';
import { getSupportStats } from '@/server/queries/support';

export const metadata: Metadata = { title: 'Thống kê Hỗ trợ' };

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// Một chữ số thập phân, dấu phẩy kiểu Việt Nam: 2,5 giờ.
const hoursText = (value: number | null) =>
  value === null ? 'Chưa có' : `${value.toFixed(1).replace('.', ',').replace(',0', '')} giờ`;
const percentText = (value: number | null) => (value === null ? 'Chưa có' : `${value}%`);

function Kpi({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-md border border-border bg-surface p-4">
      <p className="text-sm text-text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {note ? <p className="mt-1 text-sm text-text-muted">{note}</p> : null}
    </div>
  );
}

function GroupTable({ title, rows }: { title: string; rows: SupportStatsGroup[] }) {
  return (
    <section className="min-w-0 rounded-md border border-border bg-surface p-4">
      <h2 className="font-bold">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-text-muted">Chưa có yêu cầu nào trong kỳ.</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-sm text-text-muted">
              <tr>
                <th className="py-1 pr-3 font-normal">Nhóm</th>
                <th className="py-1 pr-3 text-right font-normal">Tổng</th>
                <th className="py-1 pr-3 text-right font-normal">Đang mở</th>
                <th className="py-1 pr-3 text-right font-normal">Quá hạn</th>
                <th className="py-1 text-right font-normal">Xử lý trung bình</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-t border-border">
                  <td className="py-1.5 pr-3">{row.label}</td>
                  <td className="py-1.5 pr-3 text-right">{formatNumber(row.total)}</td>
                  <td className="py-1.5 pr-3 text-right">{formatNumber(row.open)}</td>
                  <td
                    className={`py-1.5 pr-3 text-right ${row.overdue > 0 ? 'font-bold text-danger' : ''}`}
                  >
                    {formatNumber(row.overdue)}
                  </td>
                  <td className="py-1.5 text-right">{hoursText(row.avgResolveHours)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default async function SupportStatsPage({ searchParams }: PageProps) {
  await requirePermission('support.request.manage');
  const range = supportStatsUrlParams().parse(await searchParams);
  const stats = await getSupportStats(range);

  return (
    <>
      <h1 className="text-2xl font-bold text-brand">Hỗ trợ</h1>
      <SupportInboxTabs active="STATS" />
      <div className="mt-4 grid gap-2">
        <DateRangeFilter
          from={range.from}
          to={range.to}
          hint={`Mặc định 30 ngày gần nhất, tối đa ${SUPPORT_STATS_MAX_DAYS} ngày.`}
        />
        <p className="text-sm text-text-muted">
          Yêu cầu gửi từ {isoDateToDisplay(stats.from)} tới {isoDateToDisplay(stats.to)}, trong phạm
          vi của bạn.
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="Yêu cầu trong kỳ"
          value={formatNumber(stats.total)}
          note={`${formatNumber(stats.done)} đã xong`}
        />
        <Kpi label="Đang mở" value={formatNumber(stats.open)} />
        <Kpi label="Đang quá hạn" value={formatNumber(stats.overdue)} />
        <Kpi
          label="Phản hồi đầu đúng hạn"
          value={percentText(stats.firstResponseOnTimePercent)}
          note={`Xử lý xong đúng hạn: ${percentText(stats.resolveOnTimePercent)}`}
        />
        <Kpi label="Phản hồi đầu trung bình" value={hoursText(stats.avgFirstResponseHours)} />
        <Kpi label="Xử lý xong trung bình" value={hoursText(stats.avgResolveHours)} />
      </div>
      <p className="mt-2 text-sm text-text-muted">
        Thời gian trung bình tính liền cả ngoài giờ; đúng hạn so với thời hạn theo giờ làm việc ở
        Tham số.
        {stats.truncated
          ? ' Kỳ có quá nhiều yêu cầu, số liệu tính trên 5.000 yêu cầu mới nhất.'
          : ''}
      </p>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <GroupTable title="Theo đơn vị" rows={stats.byUnit} />
        <div className="grid content-start gap-4">
          <GroupTable title="Theo loại" rows={stats.byType} />
          <GroupTable title="Báo lỗi theo mức độ" rows={stats.bySeverity} />
        </div>
      </div>
    </>
  );
}
