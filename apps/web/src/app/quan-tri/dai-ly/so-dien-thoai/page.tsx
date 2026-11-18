import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import {
  badPhonesUrlParams,
  PHONE_ISSUE_LABEL,
  phoneIssueKind,
  type ListBadPhonesInput,
} from '@dms/contracts/dealer-cleanup';
import { formatNumber } from '@dms/contracts/format';
import { DataTableSkeleton } from '@dms/ui/data-table-skeleton';
import { BadPhonesTable } from '@/features/dealers/components/bad-phones-table';
import { requirePermission } from '@/server/auth/can';
import { getBadPhones } from '@/server/queries/dealer-cleanup';

export const metadata: Metadata = { title: 'Số điện thoại sai dạng' };

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function BadPhonesPage({ searchParams }: PageProps) {
  await requirePermission('admin.dealer.cleanup');
  const input = badPhonesUrlParams.parse(await searchParams);
  return (
    <>
      <h1 className="text-2xl font-bold text-brand">Số điện thoại sai dạng</h1>
      <p className="mt-1 max-w-3xl text-text-muted">
        Số điện thoại đại lý nhập từ DMS cũ không đúng dạng 10 số. Sửa lại số đúng, hoặc bỏ số để
        trống chờ người phụ trách cập nhật. Mọi lần sửa đều ghi nhật ký. Khi nối FAST, số đã sửa sẽ
        đồng bộ sang FAST.
      </p>
      <Suspense key={JSON.stringify(input)} fallback={<DataTableSkeleton columns={4} rows={8} />}>
        <Results input={input} />
      </Suspense>
    </>
  );
}

async function Results({ input }: { input: ListBadPhonesInput }) {
  const data = await getBadPhones(input);
  const all = Object.values(data.counts).reduce((sum, value) => sum + value, 0);
  const tabs = [
    { value: undefined, label: 'Tất cả', count: all },
    ...phoneIssueKind.options.map((kind) => ({
      value: kind,
      label: PHONE_ISSUE_LABEL[kind],
      count: data.counts[kind] ?? 0,
    })),
  ];
  return (
    <>
      <nav aria-label="Nhóm số sai" className="mt-4 flex flex-wrap gap-2 border-b border-border">
        {tabs.map((tab) => {
          const active = tab.value === input.kind;
          return (
            <Link
              key={tab.label}
              href={
                tab.value
                  ? `/quan-tri/dai-ly/so-dien-thoai?loai=${tab.value}`
                  : '/quan-tri/dai-ly/so-dien-thoai'
              }
              aria-current={active ? 'page' : undefined}
              className={`-mb-px border-b-2 px-3 py-2 font-bold ${active ? 'border-brand text-brand' : 'border-transparent text-text-muted hover:text-brand'}`}
            >
              {tab.label} ({formatNumber(tab.count)})
            </Link>
          );
        })}
      </nav>
      <BadPhonesTable data={data} kind={input.kind} />
    </>
  );
}
