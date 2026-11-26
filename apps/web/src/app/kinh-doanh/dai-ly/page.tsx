import type { Metadata } from 'next';
import Link from 'next/link';
import { DealerListPage } from '@/features/dealers/components/dealer-pages';
import { can } from '@/server/auth/can';
import { requireUser } from '@/server/auth/current-user';

export const metadata: Metadata = { title: 'Đại lý' };

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function KinhDoanhDealersPage({ searchParams }: PageProps) {
  const user = await requireUser();
  // 26/11/2026: mọi vai trò có quyền đề xuất đại lý mới đều thêm được trên web.
  const canAdd = can(user, 'sales.dealer.propose');
  return (
    <DealerListPage
      entry="sales.dealer.read"
      basePath="/kinh-doanh/dai-ly"
      searchParams={searchParams}
      description="Đại lý trong phạm vi bạn phụ trách. Công nợ và hạn mức sẽ hiện khi nối FAST."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/kinh-doanh/dai-ly/de-xuat"
            className="inline-flex h-9.5 items-center rounded-md border border-brand bg-surface px-4 font-bold text-brand hover:bg-brand-soft"
          >
            Đại lý đề xuất
          </Link>
          {canAdd ? (
            <Link
              href="/kinh-doanh/dai-ly/tao-moi"
              className="inline-flex h-9.5 items-center rounded-md bg-brand px-4 font-bold text-primary-foreground hover:bg-brand-hover"
            >
              Thêm đại lý
            </Link>
          ) : null}
        </div>
      }
    />
  );
}
