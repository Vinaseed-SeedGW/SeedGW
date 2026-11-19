import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import {
  dealerLocationUrlParams,
  type DealerLocationTab,
  type ListDealerLocationProposalsInput,
} from '@seedgw/contracts/dealer-locations';
import { DataTableSkeleton } from '@seedgw/ui/data-table-skeleton';
import { DealerLocationsTable } from '@/features/dealers/components/dealer-locations-table';
import { requirePermission } from '@/server/auth/can';
import { listDealerLocationProposals } from '@/server/queries/dealer-locations';

export const metadata: Metadata = { title: 'Duyệt toạ độ đại lý' };

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const TABS: { value: DealerLocationTab; label: string }[] = [
  { value: 'cho-duyet', label: 'Chờ duyệt' },
  { value: 'da-xu-ly', label: 'Đã xử lý' },
];

export default async function DealerLocationsPage({ searchParams }: PageProps) {
  await requirePermission('admin.dealer-location.approve');
  const input = dealerLocationUrlParams.parse(await searchParams);

  return (
    <>
      <h1 className="text-2xl font-bold text-brand">Duyệt toạ độ đại lý</h1>
      <p className="mt-1 max-w-3xl text-text-muted">
        Lần check-in đầu tại đại lý chưa có toạ độ tạo một đề xuất. Xem ảnh và địa chỉ lúc chụp rồi
        duyệt; từ lượt check-in sau hệ thống so khoảng cách với toạ độ đã duyệt.
      </p>
      <nav aria-label="Trạng thái đề xuất" className="mt-4 flex gap-2 border-b border-border">
        {TABS.map((tab) => {
          const active = tab.value === input.tab;
          return (
            <Link
              key={tab.value}
              href={`/quan-tri/dai-ly/duyet-toa-do?tab=${tab.value}`}
              aria-current={active ? 'page' : undefined}
              className={`-mb-px border-b-2 px-3 py-2 font-bold ${active ? 'border-brand text-brand' : 'border-transparent text-text-muted hover:text-brand'}`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      <Suspense key={input.tab} fallback={<DataTableSkeleton columns={5} rows={6} />}>
        <ProposalResults input={input} />
      </Suspense>
    </>
  );
}

async function ProposalResults({ input }: { input: ListDealerLocationProposalsInput }) {
  return <DealerLocationsTable data={await listDealerLocationProposals(input)} tab={input.tab} />;
}
