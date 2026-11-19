import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import {
  checkInsUrlParams,
  checkInTabParam,
  dayMapUrlParams,
  type CheckInTab,
  type DayMapInput,
  type ListCheckInsInput,
} from '@seedgw/contracts/check-ins';
import { DataTableSkeleton } from '@seedgw/ui/data-table-skeleton';
import { CheckInsTable } from '@/features/check-ins/components/check-ins-table';
import { DayMapView } from '@/features/check-ins/components/day-map-view';
import { requirePermission } from '@/server/auth/can';
import { mapTileConfig } from '@/server/integrations/map-tiles';
import { listCheckIns } from '@/server/queries/check-ins';
import { getDayMap, getDayMapFilterOptions } from '@/server/queries/day-map';

export const metadata: Metadata = { title: 'Check-in' };

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const TABS: { value: CheckInTab; label: string; href: string }[] = [
  { value: 'danh-sach', label: 'Danh sách', href: '/kinh-doanh/check-in' },
  { value: 'ban-do', label: 'Bản đồ', href: '/kinh-doanh/check-in?tab=ban-do' },
];

export default async function CheckInReportPage({ searchParams }: PageProps) {
  await requirePermission('sales.check-in.read');
  const params = await searchParams;
  const { tab } = checkInTabParam.parse(params);

  return (
    <>
      <h1 className="text-2xl font-bold text-brand">Check-in</h1>
      <p className="mt-1 text-text-muted">
        Các lượt check-in nhân viên gửi từ app, kèm địa chỉ, ảnh, km theo đường đi và theo GPS từ
        lượt trước, bản đồ hành trình trong ngày. Check-in chỉ làm trên app.
      </p>
      <nav aria-label="Cách xem" className="mt-4 flex gap-2 border-b border-border">
        {TABS.map((item) => (
          <Link
            key={item.value}
            href={item.href}
            aria-current={item.value === tab ? 'page' : undefined}
            className={`-mb-px border-b-2 px-3 py-2 font-bold ${
              item.value === tab
                ? 'border-brand text-brand'
                : 'border-transparent text-text-muted hover:text-brand'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {tab === 'ban-do' ? (
        <Suspense
          fallback={
            <div className="mt-4 h-[60vh] min-h-80 animate-pulse rounded-md bg-surface-subtle" />
          }
        >
          <DayMapSection input={dayMapUrlParams().parse(params)} />
        </Suspense>
      ) : (
        <Suspense fallback={<DataTableSkeleton columns={7} rows={8} />}>
          <CheckInResults input={checkInsUrlParams().parse(params)} />
        </Suspense>
      )}
    </>
  );
}

async function CheckInResults({ input }: { input: ListCheckInsInput }) {
  return <CheckInsTable data={await listCheckIns(input)} input={input} />;
}

async function DayMapSection({ input }: { input: DayMapInput }) {
  const [options, data] = await Promise.all([
    getDayMapFilterOptions(input.orgUnitId),
    getDayMap(input),
  ]);
  return <DayMapView input={input} options={options} data={data} tiles={mapTileConfig()} />;
}
