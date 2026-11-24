import type { Metadata } from 'next';
import { Suspense } from 'react';
import { DataTableSkeleton } from '@seedgw/ui/data-table-skeleton';
import { ProvincesTable } from '@/features/regions/components/provinces-table';
import { can, requirePermission } from '@/server/auth/can';
import { getProvinceRows, getRegions } from '@/server/queries/regions';

export const metadata: Metadata = { title: 'Vùng và tỉnh' };

export default async function RegionsPage() {
  const user = await requirePermission('admin.region.read');
  return (
    <>
      <h1 className="text-2xl font-bold text-brand">Vùng và tỉnh</h1>
      <p className="mt-1 max-w-3xl text-text-muted">
        Vùng canh tác của 34 tỉnh, dùng cho bộ lọc Vùng, Tỉnh trên Dashboard, Báo cáo, Tổng quan và
        Lịch vụ. Tỉnh mới gộp từ tỉnh cũ ở hai vùng xếp theo phần trồng lúa chính. Tỉnh phụ trách
        của từng đơn vị sửa ở Cơ cấu tổ chức.
      </p>
      <Suspense fallback={<DataTableSkeleton columns={4} rows={8} />}>
        <ProvinceResults canManage={can(user, 'admin.region.manage')} />
      </Suspense>
    </>
  );
}

async function ProvinceResults({ canManage }: { canManage: boolean }) {
  const [rows, regions] = await Promise.all([getProvinceRows(), getRegions()]);
  return (
    <div className="mt-4">
      <ProvincesTable rows={rows} regions={regions} canManage={canManage} />
    </div>
  );
}
