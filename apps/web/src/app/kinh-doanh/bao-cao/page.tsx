import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { DASHBOARD_PERIOD_LABEL, type SeasonRange } from '@seedgw/contracts/dashboard';
import { isoDateToDisplay } from '@seedgw/contracts/format';
import {
  REPORT_GROUP_LABEL,
  REPORT_GROUPS,
  reportUrlParams,
  type ReportInput,
} from '@seedgw/contracts/reports';
import { formatMonthLabel } from '@seedgw/contracts/sales-targets';
import { DataTableSkeleton } from '@seedgw/ui/data-table-skeleton';
import { DashboardFilters } from '@/features/dashboard/components/dashboard-filters';
import { ExportReportButton, ReportTable } from '@/features/reports/components/report-tables';
import { requirePermission } from '@/server/auth/can';
import { getDashboardFilterOptions } from '@/server/queries/dashboard';
import { getReport } from '@/server/queries/reports';
import { getSeasons } from '@/server/queries/seasons';

export const metadata: Metadata = { title: 'Báo cáo' };

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function groupHref(params: Record<string, string | string[] | undefined>, group: string): string {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && key !== 'theo' && key !== 'trang') next.set(key, value);
  }
  next.set('theo', group);
  return `/kinh-doanh/bao-cao?${next.toString()}`;
}

export default async function ReportPage({ searchParams }: PageProps) {
  await requirePermission('sales.report.read');
  const [raw, seasons] = await Promise.all([searchParams, getSeasons()]);
  const input = reportUrlParams(new Date(), seasons).parse(raw);
  const periodText =
    input.from === input.to
      ? isoDateToDisplay(input.from)
      : `${isoDateToDisplay(input.from)} tới ${isoDateToDisplay(input.to)}`;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-brand">Báo cáo Kinh doanh</h1>
          <p className="mt-1 max-w-3xl text-text-muted">
            Lượt ghé thăm, đại lý được ghé, độ phủ, km và chỉ tiêu theo nhân viên, đơn vị hoặc đại
            lý trong phạm vi bạn được xem. Thực bán có khi nối FAST.
          </p>
        </div>
        <ExportReportButton />
      </div>
      <Suspense fallback={<div className="mt-4 h-10 animate-pulse rounded-md bg-surface-subtle" />}>
        <Filters input={input} seasons={seasons} />
      </Suspense>
      <nav aria-label="Xem theo" className="mt-4 flex flex-wrap gap-2 border-b border-border">
        {REPORT_GROUPS.map((group) => {
          const active = group === input.group;
          return (
            <Link
              key={group}
              href={groupHref(raw, group)}
              aria-current={active ? 'page' : undefined}
              className={`-mb-px border-b-2 px-3 py-2 font-bold ${active ? 'border-brand text-brand' : 'border-transparent text-text-muted hover:text-brand'}`}
            >
              {REPORT_GROUP_LABEL[group]}
            </Link>
          );
        })}
      </nav>
      <p className="mt-3 font-bold">
        {DASHBOARD_PERIOD_LABEL[input.period]}, {periodText}
      </p>
      <Suspense key={JSON.stringify(input)} fallback={<DataTableSkeleton columns={5} rows={8} />}>
        <ReportResults input={input} />
      </Suspense>
    </>
  );
}

async function Filters({ input, seasons }: { input: ReportInput; seasons: SeasonRange[] }) {
  const options = await getDashboardFilterOptions(input.orgUnitId);
  return (
    <div className="mt-4">
      <DashboardFilters input={input} options={options} seasons={seasons} />
    </div>
  );
}

async function ReportResults({ input }: { input: ReportInput }) {
  const result = await getReport(input);
  return (
    <>
      {result.group !== 'dai-ly' ? (
        <p className="mt-1 text-sm text-text-muted">
          {result.targetMonths
            ? `Chỉ tiêu cộng các tháng: ${result.targetMonths.map(formatMonthLabel).join(', ')}.`
            : 'Chỉ tiêu tính theo tháng, chọn kỳ Tháng, Quý, Vụ hoặc Năm để so với chỉ tiêu.'}
        </p>
      ) : null}
      <ReportTable result={result} />
    </>
  );
}
