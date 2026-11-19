import type { Metadata } from 'next';
import Link from 'next/link';
import { DealerListPage } from '@/features/dealers/components/dealer-pages';
import { RematchAssigneesButton } from '@/features/dealers/components/rematch-assignees-button';
import { can } from '@/server/auth/can';
import { requireUser } from '@/server/auth/current-user';

export const metadata: Metadata = { title: 'Đại lý' };

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function QuanTriDealersPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const canManage = can(user, 'admin.dealer.manage');
  return (
    <DealerListPage
      entry="admin.dealer.read"
      basePath="/quan-tri/dai-ly"
      searchParams={searchParams}
      description="Danh mục đại lý. Nhập từ hệ thống cũ, gán nhân viên và đơn vị phụ trách hàng loạt."
      actions={
        canManage ? (
          <div className="flex flex-wrap items-center gap-2">
            <RematchAssigneesButton />
            <Link
              href="/quan-tri/dai-ly/nhap-excel"
              className="inline-flex h-9.5 items-center rounded-md bg-brand px-4 font-bold text-primary-foreground hover:bg-brand-hover"
            >
              Nhập Excel
            </Link>
          </div>
        ) : null
      }
    />
  );
}
