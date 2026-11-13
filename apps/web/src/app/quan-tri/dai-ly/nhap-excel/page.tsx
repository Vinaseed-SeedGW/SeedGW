import type { Metadata } from 'next';
import { DealerImportWizard } from '@/features/dealers/components/dealer-import-wizard';
import { requirePermission } from '@/server/auth/can';
import { getDealerFormOptions } from '@/server/queries/dealers';

export const metadata: Metadata = { title: 'Nhập đại lý từ Excel' };

export default async function DealerImportPage() {
  await requirePermission('admin.dealer.manage');
  const options = await getDealerFormOptions();
  return (
    <>
      <h1 className="text-2xl font-bold text-brand">Nhập đại lý từ Excel</h1>
      <p className="mt-1 max-w-3xl text-text-muted">
        Chọn file Danh sách khách hàng xuất từ DMS cũ. Nhập lại nhiều lần được: đại lý ghép theo mã
        DMS cũ, chỉ cập nhật tên, mã FAST, mã số thuế; thông tin đã sửa trên DMS mới được giữ
        nguyên.
      </p>
      <DealerImportWizard orgUnits={options.orgUnits} />
    </>
  );
}
