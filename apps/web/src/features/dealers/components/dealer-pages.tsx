import { notFound } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';
import { z } from 'zod';
import { dealerFilter, dealersUrlParams, type ListDealersInput } from '@dms/contracts/dealers';
import { DataTableSkeleton } from '@dms/ui/data-table-skeleton';
import { requirePermission } from '@/server/auth/can';
import {
  getDealer,
  getDealerFormOptions,
  listDealerOrgUnitFilter,
  listDealers,
  listDealerVisits,
  type DealerEntry,
} from '@/server/queries/dealers';
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
  const [data, orgUnitFilter, editOptions] = await Promise.all([
    listDealers(input, entry),
    listDealerOrgUnitFilter(),
    getDealerFormOptions(),
  ]);
  const filter = dealerFilter.parse(input);
  const canEdit = editOptions.canEdit;
  return (
    <DealersTable
      data={data}
      filter={filter}
      basePath={basePath}
      orgUnitFilter={orgUnitFilter}
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
