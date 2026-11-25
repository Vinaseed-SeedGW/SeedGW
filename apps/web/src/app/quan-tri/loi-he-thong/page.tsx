import type { Metadata } from 'next';
import { Suspense } from 'react';
import { errorLogsUrlParams, type ListErrorLogsInput } from '@seedgw/contracts/error-logs';
import { DataTableSkeleton } from '@seedgw/ui/data-table-skeleton';
import { ErrorLogsTable } from '@/features/error-logs/components/error-logs-table';
import { requirePermission } from '@/server/auth/can';
import { listErrorLogs } from '@/server/queries/error-logs';

export const metadata: Metadata = { title: 'Lỗi hệ thống' };

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ErrorLogsPage({ searchParams }: PageProps) {
  await requirePermission('admin.error-log.read');
  const input = errorLogsUrlParams.parse(await searchParams);
  return (
    <>
      <h1 className="text-2xl font-bold text-brand">Lỗi hệ thống</h1>
      <p className="mt-1 text-text-muted">
        Lỗi tự ghi của máy chủ web, trình duyệt, app điện thoại và worker. Lỗi giống nhau gộp một
        dòng, giữ 90 ngày. Không ghi mật khẩu, token hay nội dung người dùng nhập.
      </p>
      <Suspense fallback={<DataTableSkeleton columns={4} rows={8} />}>
        <ErrorLogResults input={input} />
      </Suspense>
    </>
  );
}

async function ErrorLogResults({ input }: { input: ListErrorLogsInput }) {
  return <ErrorLogsTable data={await listErrorLogs(input)} />;
}
