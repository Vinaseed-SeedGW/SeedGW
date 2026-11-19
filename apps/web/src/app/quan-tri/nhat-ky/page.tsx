import type { Metadata } from 'next';
import { Suspense } from 'react';
import { auditUrlParams, type ListAuditLogsInput } from '@seedgw/contracts/audit';
import { DataTableSkeleton } from '@seedgw/ui/data-table-skeleton';
import { AuditLogsTable } from '@/features/audit/components/audit-logs-table';
import { requirePermission } from '@/server/auth/can';
import { listAuditLogs } from '@/server/queries/audit-logs';

export const metadata: Metadata = { title: 'Nhật ký' };

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AuditLogPage({ searchParams }: PageProps) {
  await requirePermission('admin.audit-log.read');
  const input = auditUrlParams.parse(await searchParams);

  return (
    <>
      <h1 className="text-2xl font-bold text-brand">Nhật ký</h1>
      <Suspense fallback={<DataTableSkeleton columns={6} rows={8} />}>
        <AuditLogResults input={input} />
      </Suspense>
    </>
  );
}

async function AuditLogResults({ input }: { input: ListAuditLogsInput }) {
  return <AuditLogsTable data={await listAuditLogs(input)} />;
}
