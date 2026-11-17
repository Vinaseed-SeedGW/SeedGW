import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense, type ReactNode } from 'react';
import { CHECK_IN_PLACE_KIND_LABEL, formatKm } from '@dms/contracts/check-ins';
import {
  DASHBOARD_PERIOD_LABEL,
  dashboardUrlParams,
  type Coverage,
  type DashboardInput,
  type DashboardResult,
} from '@dms/contracts/dashboard';
import { DEALER_LEVEL_LABEL } from '@dms/contracts/dealers';
import {
  formatDate,
  formatDateTime,
  formatNumber,
  isoDateToDisplay,
  vietnamToday,
} from '@dms/contracts/format';
import { DashboardFilters } from '@/features/dashboard/components/dashboard-filters';
import { VisitsChartLazy } from '@/features/dashboard/components/visits-chart-lazy';
import { requirePermission } from '@/server/auth/can';
import { getDashboard, getDashboardFilterOptions } from '@/server/queries/dashboard';

export const metadata: Metadata = { title: 'Dashboard' };

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function DashboardPage({ searchParams }: PageProps) {
  await requirePermission('sales.dashboard.read');
  const input = dashboardUrlParams().parse(await searchParams);

  return (
    <>
      <h1 className="text-2xl font-bold text-brand">Dashboard</h1>
      <p className="mt-1 text-text-muted">
        Số liệu check-in và đại lý trong phạm vi bạn được xem. Thực bán và chỉ tiêu có khi nối FAST.
      </p>
      <Suspense fallback={<div className="mt-4 h-10 animate-pulse rounded-md bg-surface-subtle" />}>
        <Filters input={input} />
      </Suspense>
      <Suspense key={JSON.stringify(input)} fallback={<DashboardSkeleton />}>
        <DashboardBody input={input} />
      </Suspense>
    </>
  );
}

async function Filters({ input }: { input: DashboardInput }) {
  const options = await getDashboardFilterOptions(input.orgUnitId);
  return (
    <div className="mt-4">
      <DashboardFilters input={input} options={options} />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="mt-6 grid gap-4" aria-label="Đang tải số liệu">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((key) => (
          <div key={key} className="h-28 animate-pulse rounded-md bg-surface-subtle" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-md bg-surface-subtle" />
    </div>
  );
}

function percent(value: Coverage): string {
  if (value.active === 0 || value.covered === 0) return '0%';
  const ratio = (value.covered / value.active) * 100;
  // Độ phủ rất nhỏ (ví dụ 5 trên 15.753 đại lý) giữ 2 số lẻ để không hiện thành 0%.
  const rounded = ratio < 1 ? Math.round(ratio * 100) / 100 : Math.round(ratio * 10) / 10;
  // formatNumber làm tròn số nguyên, phần trăm cần giữ số lẻ nên tự đổi dấu thập phân.
  return `${String(rounded).replace('.', ',')}%`;
}

/** Link sang danh sách đã lọc tương ứng với khối số (IA §3.1). */
function checkInHref(input: DashboardInput, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams({
    'tu-ngay': isoDateToDisplay(input.from),
    'den-ngay': isoDateToDisplay(input.to),
    ...(input.employeeCode ? { q: input.employeeCode } : {}),
    ...extra,
  });
  return `/kinh-doanh/check-in?${params.toString()}`;
}

function dealerHref(input: DashboardInput, extra: Record<string, string>): string {
  const params = new URLSearchParams({
    'trang-thai': 'dang-hoat-dong',
    ...(input.orgUnitId ? { 'don-vi': input.orgUnitId } : {}),
    ...(input.level ? { cap: String(input.level) } : {}),
    ...extra,
  });
  return `/kinh-doanh/dai-ly?${params.toString()}`;
}

async function DashboardBody({ input }: { input: DashboardInput }) {
  const data = await getDashboard(input);
  const updated = `Cập nhật lúc ${formatDateTime(data.updatedAt).slice(-5)}`;
  const periodText =
    input.from === input.to
      ? isoDateToDisplay(input.from)
      : `${isoDateToDisplay(input.from)} tới ${isoDateToDisplay(input.to)}`;

  return (
    <div className="mt-6 grid gap-8">
      <section aria-labelledby="so-chinh" className="grid gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="so-chinh" className="text-lg font-bold">
            {DASHBOARD_PERIOD_LABEL[input.period]}, {periodText}
          </h2>
          <span className="text-sm text-text-muted">{updated}</span>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi
            href={checkInHref(input)}
            label="Lượt ghé thăm"
            value={formatNumber(data.kpi.visits)}
          />
          <Kpi
            href={dealerHref(input, {})}
            label="Độ phủ đại lý"
            value={percent(data.kpi.coverage)}
            note={`${formatNumber(data.kpi.coverage.covered)} trên ${formatNumber(data.kpi.coverage.active)} đại lý`}
          />
          <Kpi
            href={checkInHref({ ...input, from: vietnamToday(), to: vietnamToday() })}
            label="Nhân viên đã check-in hôm nay"
            value={`${formatNumber(data.kpi.staffCheckedInToday)}/${formatNumber(data.kpi.staffTotal)}`}
            note="Trên tổng số NVKD đang hoạt động"
          />
          <Kpi
            href={checkInHref(input)}
            label="Tổng km đi thị trường"
            value={formatKm(data.kpi.gpsKm)}
            note="Theo GPS; km theo đường đi có ở bản sau"
          />
        </div>
      </section>

      <section aria-labelledby="thi-truong" className="grid gap-3">
        <h2 id="thi-truong" className="text-lg font-bold text-brand">
          Thị trường
        </h2>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Panel title="Lượt ghé thăm theo ngày">
            {data.kpi.visits === 0 ? (
              <p className="text-text-muted">Không có lượt check-in nào trong kỳ này.</p>
            ) : (
              <VisitsChartLazy data={data.market.perDay} />
            )}
          </Panel>
          <Panel title="Theo loại điểm">
            <dl className="grid gap-2">
              {(['DEALER', 'CUSTOMER', 'OTHER'] as const).map((kind) => (
                <Row key={kind} label={CHECK_IN_PLACE_KIND_LABEL[kind]}>
                  <Link
                    href={checkInHref(input, { 'loai-diem': kind })}
                    className="font-bold text-brand"
                  >
                    {formatNumber(data.market.byKind[kind])}
                  </Link>
                </Row>
              ))}
              <Row label="Km bình quân mỗi lượt">
                {data.market.kmPerVisit === null ? 'Chưa có' : formatKm(data.market.kmPerVisit)}
              </Row>
              <Row label="Check-in có cờ nghi vấn">
                <Link href={checkInHref(input, { 'co-co': '1' })} className="font-bold text-brand">
                  {formatNumber(data.market.flagged)}
                </Link>
              </Row>
            </dl>
          </Panel>
        </div>
      </section>

      <DealerSection input={input} data={data} />
      {data.staff ? <StaffSection data={data.staff} input={input} /> : null}
    </div>
  );
}

function DealerSection({ input, data }: { input: DashboardInput; data: DashboardResult }) {
  const { dealers } = data;
  const overdueTotal =
    dealers.overdueByLevel[1] + dealers.overdueByLevel[2] + dealers.overdueByLevel[3];
  return (
    <section aria-labelledby="dai-ly" className="grid gap-3">
      <h2 id="dai-ly" className="text-lg font-bold text-brand">
        Đại lý
      </h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          href={dealerHref(input, { 'ghe-tham': 'qua-moc' })}
          label="Quá mốc chưa ghé lại"
          value={formatNumber(overdueTotal)}
          note={([1, 2, 3] as const)
            .map(
              (level) =>
                `${DEALER_LEVEL_LABEL[level]} ${formatNumber(dealers.overdueByLevel[level])}`,
            )
            .join(', ')}
        />
        <Kpi
          href={dealerHref(input, { 'ghe-tham': 'chua-ghe' })}
          label="Chưa ghé lần nào"
          value={formatNumber(dealers.neverVisited)}
        />
        <Kpi
          href={dealerHref(input, { 'toa-do': 'chua-co' })}
          label="Chưa có toạ độ"
          value={formatNumber(dealers.missingLocation)}
        />
        <Kpi
          href={dealerHref(input, { 'nhan-vien': 'chua-gan' })}
          label="Chưa gán nhân viên"
          value={formatNumber(dealers.unassigned)}
        />
      </div>
      <p className="text-sm text-text-muted">
        Mốc quá hạn theo Tham số:{' '}
        {([1, 2, 3] as const)
          .map((level) => `${DEALER_LEVEL_LABEL[level]} ${dealers.overdueDays[level]} ngày`)
          .join(', ')}
        . Đại lý chưa ghé lần nào tính riêng.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Quá mốc lâu nhất">
          {dealers.overdueList.length === 0 ? (
            <p className="text-text-muted">Chưa có đại lý nào quá mốc chưa ghé lại.</p>
          ) : (
            <Table
              head={['Đại lý', 'Cấp', 'Phụ trách', 'Lần ghé gần nhất']}
              rows={dealers.overdueList.map((row) => [
                <Link key="name" href={`/kinh-doanh/dai-ly/${row.id}`} className="text-brand">
                  {row.name}
                </Link>,
                DEALER_LEVEL_LABEL[row.level],
                row.assignedUserName ?? 'Chưa gán',
                `${formatDate(row.lastVisitedAt)}, ${row.days} ngày`,
              ])}
            />
          )}
        </Panel>
        <Panel title="Độ phủ theo cấp và theo đơn vị">
          <Table
            head={['Cấp', 'Được ghé', 'Đang hoạt động', 'Độ phủ']}
            rows={dealers.coverageByLevel.map((row) => [
              DEALER_LEVEL_LABEL[row.level],
              formatNumber(row.covered),
              formatNumber(row.active),
              percent(row),
            ])}
          />
          {dealers.coverageByUnit.length > 1 ? (
            <div className="mt-4">
              <Table
                head={['Đơn vị', 'Được ghé', 'Đang hoạt động', 'Độ phủ']}
                rows={dealers.coverageByUnit.map((row) => [
                  row.unitName,
                  formatNumber(row.covered),
                  formatNumber(row.active),
                  percent(row),
                ])}
              />
            </div>
          ) : null}
        </Panel>
      </div>
    </section>
  );
}

function StaffSection({
  data,
  input,
}: {
  data: NonNullable<DashboardResult['staff']>;
  input: DashboardInput;
}) {
  return (
    <section aria-labelledby="nhan-vien" className="grid gap-3">
      <h2 id="nhan-vien" className="text-lg font-bold text-brand">
        Nhân viên
      </h2>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Xếp hạng theo lượt ghé thăm">
          {data.ranking.length === 0 ? (
            <p className="text-text-muted">Chưa có nhân viên nào check-in trong kỳ này.</p>
          ) : (
            <Table
              head={['Nhân viên', 'Lượt', 'Đại lý được ghé', 'Km']}
              rows={data.ranking.map((row) => [
                <Link
                  key="name"
                  href={checkInHref({ ...input, employeeCode: row.code })}
                  className="text-brand"
                >
                  {row.code}, {row.name}
                </Link>,
                formatNumber(row.visits),
                `${formatNumber(row.coveredDealers)}/${formatNumber(row.assignedDealers)}`,
                formatKm(row.km),
              ])}
            />
          )}
        </Panel>
        <Panel title={`Chưa check-in hôm nay (${formatNumber(data.notCheckedInTotal)} người)`}>
          {data.notCheckedInToday.length === 0 ? (
            <p className="text-text-muted">Mọi nhân viên đã check-in hôm nay.</p>
          ) : (
            <ul className="grid max-h-80 gap-1 overflow-y-auto">
              {data.notCheckedInToday.map((row) => (
                <li key={row.code}>
                  {row.code}, {row.name}
                  {row.orgUnitName ? (
                    <span className="text-sm text-text-muted">, {row.orgUnitName}</span>
                  ) : null}
                </li>
              ))}
              {data.notCheckedInTotal > data.notCheckedInToday.length ? (
                <li className="text-sm text-text-muted">
                  Và {formatNumber(data.notCheckedInTotal - data.notCheckedInToday.length)} người
                  khác. Chọn đơn vị để xem gọn hơn.
                </li>
              ) : null}
            </ul>
          )}
        </Panel>
      </div>
    </section>
  );
}

function Kpi({
  href,
  label,
  value,
  note,
}: {
  href: string;
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <Link
      href={href}
      className="grid content-start gap-1 rounded-md border border-border bg-surface p-4 hover:border-brand hover:bg-brand-soft"
    >
      <span className="text-sm text-text-muted">{label}</span>
      <span className="text-2xl font-bold text-brand">{value}</span>
      {note ? <span className="text-sm text-text-muted">{note}</span> : null}
    </Link>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="grid content-start gap-3 rounded-md border border-border bg-surface p-4">
      <h3 className="font-bold">{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border pb-2 last:border-b-0">
      <dt className="text-text-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-96 text-sm">
        <thead>
          <tr className="border-b border-border text-left text-text-muted">
            {head.map((cell) => (
              <th key={cell} scope="col" className="py-1.5 pr-3 font-normal">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-b border-border last:border-b-0">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="py-1.5 pr-3">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
