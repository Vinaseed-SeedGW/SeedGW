import type { Metadata } from 'next';
import Link from 'next/link';
import { DealerListPage } from '@/features/dealers/components/dealer-pages';

export const metadata: Metadata = { title: 'Đại lý' };

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default function KinhDoanhDealersPage({ searchParams }: PageProps) {
  return (
    <DealerListPage
      entry="sales.dealer.read"
      basePath="/kinh-doanh/dai-ly"
      searchParams={searchParams}
      description="Đại lý trong phạm vi bạn phụ trách. Công nợ và hạn mức sẽ hiện khi nối FAST."
      actions={
        <Link
          href="/kinh-doanh/dai-ly/de-xuat"
          className="inline-flex h-9.5 items-center rounded-md border border-brand bg-surface px-4 font-bold text-brand hover:bg-brand-soft"
        >
          Đại lý đề xuất
        </Link>
      }
    />
  );
}
