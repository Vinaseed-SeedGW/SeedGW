import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { vietnamToday } from '@dms/contracts/format';
import {
  addDays,
  formatRoutePeriod,
  mondayOf,
  routesUrlParams,
  type ListRoutePlansInput,
  type RouteTab,
} from '@dms/contracts/route-plans';
import { DataTableSkeleton } from '@dms/ui/data-table-skeleton';
import { MyRoutes } from '@/features/route-plans/components/my-routes';
import { ScopeRoutesTable } from '@/features/route-plans/components/scope-routes-table';
import { can, requirePermission } from '@/server/auth/can';
import { getMyRoutes, listRoutePlans } from '@/server/queries/route-plans';

export const metadata: Metadata = { title: 'Tuyến viếng thăm' };

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const TAB_LABEL: Record<RouteTab, string> = {
  'cua-toi': 'Tuyến của tôi',
  'pham-vi': 'Trong phạm vi',
};

export default async function RoutePlansPage({ searchParams }: PageProps) {
  const user = await requirePermission('sales.route.read');
  const tabs: RouteTab[] = [];
  if (can(user, 'sales.route.register')) tabs.push('cua-toi');
  // Nhân viên chỉ thấy chính mình nên không cần tab Trong phạm vi.
  if (user.dataScope !== 'OWN') tabs.push('pham-vi');
  const parsed = routesUrlParams.parse(await searchParams);
  const input: ListRoutePlansInput = tabs.includes(parsed.tab)
    ? parsed
    : { ...parsed, tab: tabs[0] ?? 'cua-toi' };

  return (
    <>
      <h1 className="text-2xl font-bold text-brand">Tuyến viếng thăm</h1>
      <p className="mt-1 max-w-3xl text-text-muted">
        Nhân viên đăng ký tuyến theo tuần hoặc theo ngày trên app, gửi duyệt qua Quản lý (nếu đơn vị
        có) và Lãnh đạo đơn vị. Điểm đã ghé tính từ check-in tại đại lý trong đúng ngày; check-in
        ngoài tuyến vẫn được ghi nhận.
      </p>
      {tabs.length > 1 ? (
        <nav aria-label="Nhóm tuyến" className="mt-4 flex flex-wrap gap-2 border-b border-border">
          {tabs.map((tab) => {
            const active = tab === input.tab;
            return (
              <Link
                key={tab}
                href={`/kinh-doanh/tuyen-vieng-tham?tab=${tab}`}
                aria-current={active ? 'page' : undefined}
                className={`-mb-px border-b-2 px-3 py-2 font-bold ${active ? 'border-brand text-brand' : 'border-transparent text-text-muted hover:text-brand'}`}
              >
                {TAB_LABEL[tab]}
              </Link>
            );
          })}
        </nav>
      ) : null}
      {tabs.length === 0 ? (
        <p className="mt-4 text-text-muted">Tài khoản chưa được cấp quyền đăng ký tuyến.</p>
      ) : input.tab === 'cua-toi' ? (
        <Suspense fallback={<DataTableSkeleton columns={4} rows={4} />}>
          <MyRouteResults canOpenApproval={can(user, 'sales.approval.read')} />
        </Suspense>
      ) : (
        <Suspense key={JSON.stringify(input)} fallback={<DataTableSkeleton columns={4} rows={6} />}>
          <ScopeResults input={input} />
        </Suspense>
      )}
    </>
  );
}

async function MyRouteResults({ canOpenApproval }: { canOpenApproval: boolean }) {
  return <MyRoutes data={await getMyRoutes()} canOpenApproval={canOpenApproval} />;
}

async function ScopeResults({ input }: { input: ListRoutePlansInput }) {
  const data = await listRoutePlans(input);
  const thisWeek = mondayOf(vietnamToday());
  const weeks = [7, -7, -14, -21].map((delta) => {
    const value = addDays(thisWeek, delta);
    return { value, label: formatRoutePeriod('WEEKLY', value) };
  });
  return <ScopeRoutesTable data={data} weeks={weeks} />;
}
