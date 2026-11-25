import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import {
  dealerProposalUrlParams,
  type DealerProposalTab,
  type ListDealerProposalsInput,
} from '@seedgw/contracts/dealer-proposals';
import { DataTableSkeleton } from '@seedgw/ui/data-table-skeleton';
import {
  DealerProposalsOverrideTable,
  DealerProposalsResultTable,
} from '@/features/dealers/components/dealer-proposals-table';
import { can, requirePermission } from '@/server/auth/can';
import { requireUser } from '@/server/auth/current-user';
import { getDealerProposalOptions, listDealerProposals } from '@/server/queries/dealer-proposals';

export const metadata: Metadata = { title: 'Đại lý mới' };

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const TABS: { value: DealerProposalTab; label: string }[] = [
  { value: 'cho-duyet', label: 'Chờ duyệt' },
  { value: 'da-xu-ly', label: 'Đã xử lý' },
];

export default async function DealerProposalsPage({ searchParams }: PageProps) {
  await requirePermission('admin.dealer-proposal.approve');
  const input = dealerProposalUrlParams.parse(await searchParams);

  return (
    <>
      <h1 className="text-2xl font-bold text-brand">Đại lý mới</h1>
      <p className="mt-1 max-w-3xl text-text-muted">
        Nhân viên đề xuất đại lý mới trên app ngay tại cửa hàng, kèm ảnh và vị trí lúc chụp. Quản lý
        trực tiếp hoặc Lãnh đạo đơn vị duyệt ở Kinh doanh, Cần duyệt; Quản lý, Lãnh đạo tự đề xuất
        thì tạo luôn. Trang này để theo dõi, Quản trị hệ thống duyệt thay khi cần.
      </p>
      <nav aria-label="Trạng thái đề xuất" className="mt-4 flex gap-2 border-b border-border">
        {TABS.map((tab) => {
          const active = tab.value === input.tab;
          return (
            <Link
              key={tab.value}
              href={`/quan-tri/dai-ly/dai-ly-moi?tab=${tab.value}`}
              aria-current={active ? 'page' : undefined}
              className={`-mb-px border-b-2 px-3 py-2 font-bold ${active ? 'border-brand text-brand' : 'border-transparent text-text-muted hover:text-brand'}`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      <Suspense
        key={`${input.tab}-${input.page}`}
        fallback={<DataTableSkeleton columns={5} rows={6} />}
      >
        <ProposalResults input={input} />
      </Suspense>
    </>
  );
}

async function ProposalResults({ input }: { input: ListDealerProposalsInput }) {
  const user = await requireUser();
  const pending = input.tab === 'cho-duyet';
  // Quản trị đơn vị chỉ xem (25/11/2026), giống Tuyến và Chỉ tiêu.
  if (pending && can(user, 'sales.approval.override')) {
    const [data, options] = await Promise.all([
      listDealerProposals(input),
      getDealerProposalOptions(),
    ]);
    return <DealerProposalsOverrideTable data={data} options={options} />;
  }
  const data = await listDealerProposals(input);
  return (
    <DealerProposalsResultTable
      data={data}
      dealerBasePath="/quan-tri/dai-ly"
      emptyMessage={
        pending
          ? 'Không có đề xuất đại lý mới nào chờ duyệt.'
          : 'Chưa có đề xuất đại lý mới nào được xử lý.'
      }
    />
  );
}
