import { formatDateTime, formatNumber } from '@dms/contracts/format';
import {
  targetPercent,
  type ApprovedTargetValues,
  type SalesTargetSnapshot,
  type TargetProgress,
} from '@dms/contracts/sales-targets';

type Metric = {
  label: string;
  proposed: number;
  approved: number | null;
  actual: number | null;
  unit: string;
};

function metrics(
  proposed: SalesTargetSnapshot,
  approved: ApprovedTargetValues | null,
  progress: TargetProgress,
): Metric[] {
  return [
    {
      label: 'Lượt ghé thăm',
      proposed: proposed.visitCountTarget,
      approved: approved?.visitCountTarget ?? null,
      actual: progress.visitCount,
      unit: 'lượt',
    },
    {
      label: 'Số đại lý được ghé',
      proposed: proposed.dealerCoverageTarget,
      approved: approved?.dealerCoverageTarget ?? null,
      actual: progress.dealerCoverage,
      unit: 'đại lý',
    },
    {
      label: 'Thực bán',
      proposed: proposed.salesKgTarget,
      approved: approved?.salesKgTarget ?? null,
      // Có số khi nối FAST (K3a).
      actual: null,
      unit: 'kg',
    },
  ];
}

export function PercentBar({ percent }: { percent: number | null }) {
  if (percent === null) return null;
  return (
    <span className="mt-1 block h-1.5 w-full max-w-40 overflow-hidden rounded-sm bg-surface-subtle">
      <span className="block h-full bg-brand" style={{ width: `${Math.min(percent, 100)}%` }} />
    </span>
  );
}

type Props = {
  view: {
    proposed: SalesTargetSnapshot;
    approved: ApprovedTargetValues | null;
    progress: TargetProgress;
  };
};

/** Bảng so bản đề nghị với bản đang hiệu lực và kết quả thực tế; % tính theo bản đang hiệu lực. */
export function TargetCompare({ view }: Props) {
  const rows = metrics(view.proposed, view.approved, view.progress);
  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full min-w-120 border-collapse text-left">
        <thead>
          <tr className="border-b border-border text-sm text-text-muted">
            <th scope="col" className="py-2 pr-3 font-bold">
              Chỉ tiêu
            </th>
            <th scope="col" className="py-2 pr-3 font-bold">
              Đề nghị
            </th>
            <th scope="col" className="py-2 pr-3 font-bold">
              Đang hiệu lực
            </th>
            <th scope="col" className="py-2 font-bold">
              Thực tế trong tháng
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const percent = row.actual === null ? null : targetPercent(row.actual, row.approved);
            return (
              <tr key={row.label} className="border-b border-border">
                <th scope="row" className="py-2 pr-3 font-normal">
                  {row.label}
                </th>
                <td className="py-2 pr-3 font-bold">
                  {formatNumber(row.proposed)} {row.unit}
                </td>
                <td className="py-2 pr-3">
                  {row.approved === null ? (
                    <span className="text-text-muted">Chưa có</span>
                  ) : (
                    `${formatNumber(row.approved)} ${row.unit}`
                  )}
                </td>
                <td className="py-2">
                  {row.actual === null ? (
                    <span className="text-text-muted">Có khi nối FAST</span>
                  ) : (
                    <>
                      {formatNumber(row.actual)} {row.unit}
                      {percent !== null ? `, đạt ${formatNumber(percent)}%` : ''}
                      <PercentBar percent={percent} />
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {view.approved ? (
        <p className="mt-2 text-sm text-text-muted">
          Bản đang hiệu lực được duyệt lúc {formatDateTime(view.approved.approvedAt)}.
        </p>
      ) : null}
    </div>
  );
}
