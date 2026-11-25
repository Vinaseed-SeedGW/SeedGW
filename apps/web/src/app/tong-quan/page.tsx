import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense, type ReactNode } from 'react';
import {
  changePercent,
  dashboardUrlParams,
  periodTitle,
  type DashboardInput,
} from '@seedgw/contracts/dashboard';
import { formatDateTime, formatNumber, vietnamToday } from '@seedgw/contracts/format';
import { targetPercent } from '@seedgw/contracts/sales-targets';
import { AppFooter } from '@seedgw/ui/app-footer';
import { Delta } from '@seedgw/ui/delta';
import { Logo } from '@seedgw/ui/logo';
import { MAIN_CONTENT_ID, SkipLink } from '@seedgw/ui/skip-link';
import { LogoutButton } from '@/features/auth/components/logout-button';
import { DateRangeFilter } from '@/features/shell/components/date-range-filter';
import { NotificationBell } from '@/features/notifications/components/notification-bell';
import { GlobalSearch } from '@/features/shell/components/global-search';
import { listSearchPages } from '@/features/shell/search-pages';
import { can, requirePermission } from '@/server/auth/can';
import { getExecutiveOverview } from '@/server/queries/executive';
import { getProvinceRegions, getRegions } from '@/server/queries/regions';
import { getSeasons } from '@/server/queries/seasons';

export const metadata: Metadata = { title: 'Tổng quan điều hành' };

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// Tổng quan điều hành (K6): chọn khoảng ngày (25/11/2026 thay các nút kỳ), không lọc đơn vị, nhân viên
// (xem chi tiết ở Dashboard, Báo cáo).
const LOW_COVERAGE_UNITS = 5;

/** Dashboard hôm nay, cho các ô về check-in hôm nay. */
function todayDashboardHref(): string {
  const today = vietnamToday();
  return `/kinh-doanh/dashboard?tu-ngay=${today}&den-ngay=${today}`;
}

/** Độ phủ rất nhỏ (ví dụ 1 trên 15.753 đại lý) giữ 2 số lẻ để không hiện thành 0%, như Dashboard. */
function coverageOf(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  const ratio = (part / whole) * 100;
  return ratio > 0 && ratio < 1 ? Math.round(ratio * 100) / 100 : Math.round(ratio * 10) / 10;
}

function percentText(value: number | null): string {
  return value === null ? 'Chưa có' : `${String(value).replace('.', ',')}%`;
}

function changeText(current: number, base: number): string {
  const change = changePercent(current, base);
  if (change === null) return `kỳ trước ${formatNumber(base)}`;
  if (change === 0) return 'bằng kỳ trước';
  return `${change > 0 ? 'tăng' : 'giảm'} ${Math.abs(change)}% so với kỳ trước`;
}

export default async function ExecutivePage({ searchParams }: PageProps) {
  const user = await requirePermission('executive.overview.read');
  const [raw, seasons, regions, provinces] = await Promise.all([
    searchParams,
    getSeasons(),
    getRegions(),
    getProvinceRegions(),
  ]);
  // K7: Tổng quan lọc được theo vùng (tỉnh xem ở Dashboard, Báo cáo).
  const input = dashboardUrlParams(new Date(), seasons, provinces).parse({
    ky: raw.ky,
    vu: raw.vu,
    vung: raw.vung,
    'tu-ngay': raw['tu-ngay'],
    'den-ngay': raw['den-ngay'],
  });
  // Khoảng ngày đi theo mọi link sang Dashboard, Báo cáo và khi đổi vùng.
  const rangeQuery = `tu-ngay=${input.from}&den-ngay=${input.to}`;
  const areaQuery = `${rangeQuery}${input.regionId ? `&vung=${input.regionId}` : ''}`;

  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <header className="flex h-16 flex-none items-center justify-between gap-4 border-b border-border px-4 sm:px-6">
        <Link href="/hub" aria-label="Về Hub" className="flex-none">
          <Logo variant="color" size="m" />
        </Link>
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <GlobalSearch pages={listSearchPages(user.permissions)} />
          <NotificationBell />
          <Link href="/hub" className="hidden font-bold text-brand hover:underline sm:inline">
            Về Hub
          </Link>
          <LogoutButton />
        </div>
      </header>
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className="flex-1 px-4 py-6 outline-none sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-2xl font-bold text-brand">Tổng quan điều hành</h1>
          <DateRangeFilter from={input.from} to={input.to} hint="Tối đa 366 ngày." />
        </div>
        <nav aria-label="Vùng" className="mt-3 flex flex-wrap gap-2">
          {[{ id: null, name: 'Tất cả vùng' }, ...regions].map((region) => {
            const active = region.id === input.regionId;
            return (
              <Link
                key={region.id ?? 'tat-ca'}
                href={`/tong-quan?${rangeQuery}${region.id ? `&vung=${region.id}` : ''}`}
                aria-current={active ? 'page' : undefined}
                className={`rounded-md border px-3 py-1.5 text-sm ${active ? 'border-brand bg-brand-soft font-bold text-brand' : 'border-border hover:bg-brand-soft'}`}
              >
                {region.name}
              </Link>
            );
          })}
        </nav>
        <p className="mt-1 text-sm text-text-muted">
          {periodTitle(input, seasons)}, trong phạm vi bạn được xem
          {input.regionId ? ', tính theo tỉnh của đại lý' : ''}. Thực bán và công nợ có khi nối
          FAST.
        </p>
        <Suspense key={JSON.stringify(input)} fallback={<OverviewSkeleton />}>
          <Overview
            input={input}
            areaQuery={areaQuery}
            canOpenSupport={can(user, 'support.request.manage')}
          />
        </Suspense>
      </main>
      <AppFooter variant="full" />
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="mt-4 grid gap-4" aria-label="Đang tải số liệu">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {[0, 1, 2, 3, 4, 5].map((key) => (
          <div key={key} className="h-24 animate-pulse rounded-md bg-surface-subtle" />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-md bg-surface-subtle" />
    </div>
  );
}

async function Overview({
  input,
  areaQuery,
  canOpenSupport,
}: {
  input: DashboardInput;
  areaQuery: string;
  canOpenSupport: boolean;
}) {
  const { dashboard, units, supportOverdue } = await getExecutiveOverview(input);
  const { kpi, target } = dashboard;
  const coverage = coverageOf(kpi.coverage.covered, kpi.coverage.active);
  const overdueDealers =
    dashboard.dealers.overdueByLevel[1] +
    dashboard.dealers.overdueByLevel[2] +
    dashboard.dealers.overdueByLevel[3];
  const lowUnits = units
    .filter((unit) => unit.activeDealers > 0)
    .map((unit) => ({
      ...unit,
      coverage: coverageOf(unit.dealersVisited, unit.activeDealers) ?? 0,
    }))
    .sort((a, b) => a.coverage - b.coverage)
    .slice(0, LOW_COVERAGE_UNITS);
  const ranked = [...units].sort((a, b) => b.visits - a.visits);
  const reportHref = `/kinh-doanh/bao-cao?theo=don-vi&${areaQuery}`;
  const noTarget = input.regionId ? 'Không chia chỉ tiêu theo vùng' : 'Chưa có chỉ tiêu trong kỳ';

  return (
    <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4">
      <p className="text-sm text-text-muted">
        Cập nhật lúc {formatDateTime(dashboard.updatedAt).slice(-5)}
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Card
          label="Độ phủ đại lý"
          value={percentText(coverage)}
          href={`/kinh-doanh/dashboard?${areaQuery}`}
        >
          {formatNumber(kpi.coverage.covered)} trên {formatNumber(kpi.coverage.active)} đại lý
        </Card>
        <Card
          label="Lượt ghé thăm"
          value={formatNumber(kpi.visits)}
          href={`/kinh-doanh/dashboard?${areaQuery}`}
        >
          <Delta change={changePercent(kpi.visits, dashboard.compare.previous.visits)}>
            {changeText(kpi.visits, dashboard.compare.previous.visits)}
          </Delta>
        </Card>
        <Card
          label="% chỉ tiêu lượt ghé thăm"
          value={percentText(target ? targetPercent(kpi.visits, target.visitCountTarget) : null)}
          href="/kinh-doanh/chi-tieu?tab=giao"
        >
          {target ? `Chỉ tiêu ${formatNumber(target.visitCountTarget)} lượt` : noTarget}
        </Card>
        <Card
          label="% chỉ tiêu đại lý được ghé"
          value={percentText(
            target ? targetPercent(kpi.coverage.covered, target.dealerCoverageTarget) : null,
          )}
          href="/kinh-doanh/chi-tieu?tab=giao"
        >
          {target ? `Chỉ tiêu ${formatNumber(target.dealerCoverageTarget)} đại lý` : noTarget}
        </Card>
        <Card
          label="Nhân viên đã check-in hôm nay"
          value={`${formatNumber(kpi.staffCheckedInToday)}/${formatNumber(kpi.staffTotal)}`}
          href={todayDashboardHref()}
        >
          Trên tổng số NVKD đang hoạt động
        </Card>
        <Card
          label="Yêu cầu hỗ trợ quá hạn"
          value={formatNumber(supportOverdue)}
          href={canOpenSupport ? '/quan-tri/ho-tro?han=qua-han' : null}
        >
          Chưa phản hồi hoặc chưa xử lý xong đúng hạn
        </Card>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section
          aria-labelledby="so-sanh"
          className="min-w-0 rounded-md border border-border bg-surface p-4"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="so-sanh" className="text-lg font-bold">
              So sánh các đơn vị
            </h2>
            <Link href={reportHref} className="text-sm font-bold text-brand">
              Xem đầy đủ ở Báo cáo
            </Link>
          </div>
          <div className="mt-2 max-h-96 overflow-auto">
            <table className="w-full min-w-120 text-sm">
              <thead>
                <tr className="border-b border-border text-left text-text-muted">
                  <th className="py-1.5 pr-3 font-normal">Đơn vị</th>
                  <th className="py-1.5 pr-3 text-right font-normal">Lượt ghé thăm</th>
                  <th className="py-1.5 pr-3 text-right font-normal">Độ phủ</th>
                  <th className="py-1.5 text-right font-normal">% chỉ tiêu lượt</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((unit) => (
                  <tr key={unit.id} className="border-b border-border last:border-0">
                    <td className="py-1.5 pr-3">{unit.name}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">
                      {formatNumber(unit.visits)}
                    </td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">
                      {percentText(coverageOf(unit.dealersVisited, unit.activeDealers))}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {percentText(
                        unit.target
                          ? targetPercent(unit.visits, unit.target.visitCountTarget)
                          : null,
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section
          aria-labelledby="can-chu-y"
          className="min-w-0 rounded-md border border-border bg-surface p-4"
        >
          <h2 id="can-chu-y" className="text-lg font-bold">
            Cần chú ý
          </h2>
          <ul className="mt-2 grid gap-3">
            <Attention href={reportHref} title="Đơn vị độ phủ thấp nhất">
              {lowUnits.length === 0
                ? 'Chưa có đơn vị nào có đại lý đang hoạt động.'
                : lowUnits.map((unit) => `${unit.name} ${percentText(unit.coverage)}`).join('; ')}
            </Attention>
            <Attention
              href="/kinh-doanh/dai-ly?trang-thai=dang-hoat-dong"
              title={`${formatNumber(overdueDealers)} đại lý quá mốc chưa ghé lại`}
            >
              Thêm {formatNumber(dashboard.dealers.neverVisited)} đại lý chưa ghé lần nào,{' '}
              {formatNumber(dashboard.dealers.unassigned)} đại lý chưa gán nhân viên.
            </Attention>
            <Attention
              href={todayDashboardHref()}
              title={`${formatNumber(Math.max(kpi.staffTotal - kpi.staffCheckedInToday, 0))} nhân viên chưa check-in hôm nay`}
            >
              Xem danh sách ở Dashboard, phần Nhân viên.
            </Attention>
            <Attention
              href={canOpenSupport ? '/quan-tri/ho-tro?han=qua-han' : null}
              title={`${formatNumber(supportOverdue)} yêu cầu hỗ trợ quá hạn`}
            >
              Gồm cả báo lỗi mức chặn công việc.
            </Attention>
          </ul>
        </section>
      </div>
    </div>
  );
}

function Card({
  label,
  value,
  href,
  children,
}: {
  label: string;
  value: string;
  href: string | null;
  children: ReactNode;
}) {
  const body = (
    <>
      <span className="text-sm text-text-muted">{label}</span>
      <span className="text-2xl font-bold text-brand">{value}</span>
      <span className="text-sm text-text-muted">{children}</span>
    </>
  );
  const className =
    'grid min-w-0 content-start gap-1 rounded-md border border-border bg-surface p-4';
  return href ? (
    <Link href={href} className={`${className} hover:border-brand hover:bg-brand-soft`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

function Attention({
  href,
  title,
  children,
}: {
  href: string | null;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="grid gap-0.5">
      {href ? (
        <Link href={href} className="font-bold text-brand">
          {title}
        </Link>
      ) : (
        <span className="font-bold">{title}</span>
      )}
      <span className="text-sm text-text-muted">{children}</span>
    </li>
  );
}
