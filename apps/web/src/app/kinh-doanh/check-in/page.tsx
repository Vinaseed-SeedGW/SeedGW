import type { Metadata } from 'next';
import { Suspense } from 'react';
import { checkInsUrlParams, type ListCheckInsInput } from '@dms/contracts/check-ins';
import { DataTableSkeleton } from '@dms/ui/data-table-skeleton';
import { CheckInsTable } from '@/features/check-ins/components/check-ins-table';
import { requirePermission } from '@/server/auth/can';
import { listCheckIns } from '@/server/queries/check-ins';

export const metadata: Metadata = { title: 'Check-in' };

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CheckInReportPage({ searchParams }: PageProps) {
  await requirePermission('sales.check-in.read');
  const input = checkInsUrlParams().parse(await searchParams);

  return (
    <>
      <h1 className="text-2xl font-bold text-brand">Check-in</h1>
      <p className="mt-1 text-text-muted">
        Các lượt check-in nhân viên gửi từ app, kèm địa chỉ, ảnh và km theo GPS từ lượt trước.
        Check-in chỉ làm trên app.
      </p>
      <Suspense fallback={<DataTableSkeleton columns={7} rows={8} />}>
        <CheckInResults input={input} />
      </Suspense>
    </>
  );
}

async function CheckInResults({ input }: { input: ListCheckInsInput }) {
  return <CheckInsTable data={await listCheckIns(input)} input={input} />;
}
