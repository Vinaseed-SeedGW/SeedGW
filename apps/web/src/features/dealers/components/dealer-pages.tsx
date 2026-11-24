import { notFound } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';
import { z } from 'zod';
import {
  dealerFilter,
  dealerProvinceParam,
  dealersUrlParams,
  DEALER_PROVINCE_NONE,
  type ListDealersInput,
} from '@seedgw/contracts/dealers';
import { shortProvinceName } from '@seedgw/contracts/regions';
import { DataTableSkeleton } from '@seedgw/ui/data-table-skeleton';
import { requirePermission } from '@/server/auth/can';
import {
  getDealer,
  getDealerFormOptions,
  listDealerOrgUnitFilter,
  listDealers,
  listDealerVisits,
  type DealerEntry,
} from '@/server/queries/dealers';
import { getProvinceRegions, getRegions } from '@/server/queries/regions';
import { DealerProfile } from './dealer-profile';
import { DealersTable } from './dealers-table';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type ListProps = {
  entry: DealerEntry;
  basePath: string;
  searchParams: SearchParams;
  description: string;
  actions?: ReactNode;
};

/** Trang danh sách đại lý dùng chung cho Kinh doanh và Quản trị. */
export async function DealerListPage({
  entry,
  basePath,
  searchParams,
  description,
  actions,
}: ListProps) {
  await requirePermission(entry);
  const input = dealersUrlParams.parse(await searchParams);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-brand">Đại lý</h1>
        {actions}
      </div>
      <p className="mt-1 text-text-muted">{description}</p>
      <Suspense fallback={<DataTableSkeleton columns={7} rows={8} />}>
        <DealerResults input={input} entry={entry} basePath={basePath} />
      </Suspense>
    </>
  );
}

async function DealerResults({
  input,
  entry,
  basePath,
}: {
  input: ListDealersInput;
  entry: DealerEntry;
  basePath: string;
}) {
  const [data, orgUnitFilter, editOptions, regions, provinceRegions] = await Promise.all([
    listDealers(input, entry),
    listDealerOrgUnitFilter(),
    getDealerFormOptions(),
    getRegions(),
    getProvinceRegions(),
  ]);
  const filter = dealerFilter.parse(input);
  // Đang lọc vùng thì ô Tỉnh chỉ hiện tỉnh của vùng đó; thêm dòng Chưa có tỉnh để bổ sung tỉnh còn thiếu.
  const areaFilter = {
    regions: regions.map((region) => ({ value: region.id, label: region.name })),
    provinces: [
      ...provinceRegions
        .filter((row) => !input.regionId || row.regionId === input.regionId)
        .map((row) => ({
          value: dealerProvinceParam(row.name),
          label: shortProvinceName(row.name),
        })),
      // Đại lý chưa có tỉnh không thuộc vùng nào, nên chỉ hiện khi không lọc vùng.
      ...(input.regionId
        ? []
        : [{ value: dealerProvinceParam(DEALER_PROVINCE_NONE), label: 'Chưa có tỉnh' }]),
    ],
  };
  const canEdit = editOptions.canEdit;
  return (
    <DealersTable
      data={data}
      filter={filter}
      basePath={basePath}
      orgUnitFilter={orgUnitFilter}
      areaFilter={areaFilter}
      editOptions={canEdit ? editOptions : null}
    />
  );
}

type DetailProps = { entry: DealerEntry; basePath: string; params: Promise<{ id: string }> };

export async function DealerDetailPage({ entry, basePath, params }: DetailProps) {
  await requirePermission(entry);
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();

  const [dealer, editOptions, visits] = await Promise.all([
    getDealer(id.data, entry),
    getDealerFormOptions(),
    listDealerVisits(id.data),
  ]);
  if (!dealer) notFound();
  const canEdit = editOptions.canEdit;
  return (
    <DealerProfile
      dealer={dealer}
      backHref={basePath}
      editOptions={canEdit ? editOptions : null}
      visits={visits}
    />
  );
}
