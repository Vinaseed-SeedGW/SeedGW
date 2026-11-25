import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import {
  scopedProposalsUrlParams,
  type ScopedProposalsInput,
} from '@seedgw/contracts/dealer-proposals';
import { DataTableSkeleton } from '@seedgw/ui/data-table-skeleton';
import { DealerProposalsInScopeTable } from '@/features/dealers/components/dealer-proposals-table';
import { requirePermission } from '@/server/auth/can';
import { listProposalsInScope } from '@/server/queries/dealer-proposals';

export const metadata: Metadata = { title: 'Đại lý đề xuất' };

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function DealerProposalsInScopePage({ searchParams }: PageProps) {
  const user = await requirePermission('sales.dealer.read');
  const input = scopedProposalsUrlParams.parse(await searchParams);
  const ownOnly = user.dataScope === 'OWN';

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-brand">Đại lý đề xuất</h1>
        <Link href="/kinh-doanh/dai-ly" className="font-bold text-brand">
          Về danh sách đại lý
        </Link>
      </div>
      <p className="mt-1 max-w-3xl text-text-muted">
        {ownOnly
          ? 'Đại lý bạn đề xuất khi check-in trên app và kết quả duyệt.'
          : 'Đại lý nhân viên trong phạm vi của bạn đề xuất khi check-in trên app và kết quả duyệt.'}{' '}
        Quản lý trực tiếp hoặc Lãnh đạo đơn vị duyệt; Quản lý, Lãnh đạo tự đề xuất thì đại lý được
        tạo luôn.
      </p>
      <Suspense key={JSON.stringify(input)} fallback={<DataTableSkeleton columns={4} rows={6} />}>
        <ProposalResults input={input} />
      </Suspense>
    </>
  );
}

async function ProposalResults({ input }: { input: ScopedProposalsInput }) {
  const data = await listProposalsInScope(input);
  const filtered = Boolean(input.q || input.status || input.from || input.to);
  return (
    <DealerProposalsInScopeTable
      data={data}
      emptyMessage={
        filtered
          ? 'Không có đề xuất nào phù hợp bộ lọc.'
          : 'Chưa có đề xuất đại lý mới nào. Đề xuất bằng ô Đây là đại lý mới khi check-in trên app.'
      }
    />
  );
}
