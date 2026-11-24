import type { Metadata } from 'next';
import { Suspense } from 'react';
import { DataTableSkeleton } from '@seedgw/ui/data-table-skeleton';
import { SeasonsTable } from '@/features/seasons/components/seasons-table';
import { can, requirePermission } from '@/server/auth/can';
import { getRegions } from '@/server/queries/regions';
import { getSeasons } from '@/server/queries/seasons';

export const metadata: Metadata = { title: 'Lịch vụ' };

export default async function SeasonsPage() {
  const user = await requirePermission('admin.season.read');
  return (
    <>
      <h1 className="text-2xl font-bold text-brand">Lịch vụ</h1>
      <p className="mt-1 max-w-3xl text-text-muted">
        Một lịch chung cho toàn công ty, lặp lại mọi năm: chỉ khai báo ngày và tháng. Dashboard và
        Báo cáo dùng vụ làm kỳ xem số liệu, chọn được niên vụ. Các vụ có thể chồng ngày nhau. Gắn vụ
        với vùng để khi lọc vùng chỉ hiện vụ của vùng đó.
      </p>
      <Suspense fallback={<DataTableSkeleton columns={4} rows={4} />}>
        <SeasonResults canManage={can(user, 'admin.season.manage')} />
      </Suspense>
    </>
  );
}

async function SeasonResults({ canManage }: { canManage: boolean }) {
  const [rows, regions] = await Promise.all([getSeasons(), getRegions()]);
  return <SeasonsTable rows={rows} regions={regions} canManage={canManage} />;
}
