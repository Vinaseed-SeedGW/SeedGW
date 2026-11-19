import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import {
  DUPLICATE_TAB_LABEL,
  DUPLICATE_TABS,
  duplicatesUrlParams,
  type ListDuplicatesInput,
} from '@seedgw/contracts/dealer-cleanup';
import { formatNumber } from '@seedgw/contracts/format';
import { DataTableSkeleton } from '@seedgw/ui/data-table-skeleton';
import { DuplicateGroups } from '@/features/dealers/components/duplicate-groups';
import { requirePermission } from '@/server/auth/can';
import { getDuplicateGroups } from '@/server/queries/dealer-cleanup';

export const metadata: Metadata = { title: 'Đại lý trùng' };

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function DuplicateDealersPage({ searchParams }: PageProps) {
  await requirePermission('admin.dealer.cleanup');
  const input = duplicatesUrlParams.parse(await searchParams);
  return (
    <>
      <h1 className="text-2xl font-bold text-brand">Đại lý trùng</h1>
      <p className="mt-1 max-w-3xl text-text-muted">
        Các đại lý đang hoạt động cùng số điện thoại hoặc mã số thuế. Xem từng nhóm, chọn bản giữ
        lại rồi gộp; nhóm là các đại lý khác nhau thì bấm Không phải trùng. Hai đại lý cùng có mã
        FAST cần gộp trên FAST trước. Chỉ thấy đại lý trong phạm vi của bạn.
      </p>
      <Suspense key={JSON.stringify(input)} fallback={<DataTableSkeleton columns={5} rows={6} />}>
        <Results input={input} />
      </Suspense>
    </>
  );
}

async function Results({ input }: { input: ListDuplicatesInput }) {
  const data = await getDuplicateGroups(input);
  return (
    <>
      <nav aria-label="Loại trùng" className="mt-4 flex flex-wrap gap-2 border-b border-border">
        {DUPLICATE_TABS.map((tab) => {
          const active = tab === input.tab;
          return (
            <Link
              key={tab}
              href={`/quan-tri/dai-ly/trung?tab=${tab}`}
              aria-current={active ? 'page' : undefined}
              className={`-mb-px border-b-2 px-3 py-2 font-bold ${active ? 'border-brand text-brand' : 'border-transparent text-text-muted hover:text-brand'}`}
            >
              {DUPLICATE_TAB_LABEL[tab]} ({formatNumber(data.counts[tab] ?? 0)})
            </Link>
          );
        })}
      </nav>
      <form method="get" className="mt-3 flex flex-wrap items-end gap-2">
        <input type="hidden" name="tab" value={input.tab} />
        <label className="grid gap-1 text-sm">
          Tìm theo số hoặc mã số thuế
          <input
            name="q"
            defaultValue={input.q ?? ''}
            inputMode="numeric"
            className="h-9.5 rounded-md border border-input bg-surface px-2.5"
          />
        </label>
        <button
          type="submit"
          className="h-9.5 rounded-md border border-brand bg-surface px-4 font-bold text-brand hover:bg-brand-soft"
        >
          Tìm
        </button>
      </form>
      <DuplicateGroups data={data} tab={input.tab} />
    </>
  );
}
