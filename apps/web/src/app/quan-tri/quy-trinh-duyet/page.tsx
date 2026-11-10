import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { workflowsUrlParams } from '@dms/contracts/workflows';
import { cn } from '@dms/ui/cn';
import { DataTableSkeleton } from '@dms/ui/data-table-skeleton';
import {
  DelegationsTableManaged,
  DelegationsTableReadOnly,
} from '@/features/workflows/components/delegations-table';
import { WorkflowUnitTree } from '@/features/workflows/components/workflow-unit-tree';
import { can, requirePermission } from '@/server/auth/can';
import {
  getDelegationUserOptions,
  listDelegations,
  listWorkflowUnits,
} from '@/server/queries/workflows';

export const metadata: Metadata = { title: 'Quy trình duyệt' };

const BASE_PATH = '/quan-tri/quy-trinh-duyet';

const TABS = [
  { key: 'don-vi', label: 'Theo đơn vị', href: BASE_PATH },
  { key: 'uy-quyen', label: 'Uỷ quyền', href: `${BASE_PATH}?tab=uy-quyen` },
] as const;

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function WorkflowsPage({ searchParams }: PageProps) {
  const user = await requirePermission('admin.workflow.read');
  const { tab, page, pageSize } = workflowsUrlParams.parse(await searchParams);
  const canManage = can(user, 'admin.workflow.manage');

  return (
    <>
      <h1 className="text-2xl font-bold text-brand">Quy trình duyệt</h1>
      <p className="mt-1 text-text-muted">
        Mỗi đơn vị có thể có quy trình riêng. Đơn vị chưa cấu hình sẽ kế thừa từ đơn vị cấp trên.
      </p>
      <nav className="mt-3 flex gap-1 border-b border-border" aria-label="Nội dung trang">
        {TABS.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            aria-current={tab === item.key ? 'page' : undefined}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 font-bold',
              tab === item.key ? 'border-brand text-brand' : 'border-transparent text-text-muted',
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="mt-4">
        {tab === 'uy-quyen' ? (
          <Suspense key={page} fallback={<DataTableSkeleton columns={6} rows={6} />}>
            <DelegationResults page={page} pageSize={pageSize} canManage={canManage} />
          </Suspense>
        ) : (
          <Suspense fallback={<p className="text-text-muted">Đang tải quy trình...</p>}>
            <UnitResults />
          </Suspense>
        )}
      </div>
    </>
  );
}

async function UnitResults() {
  return <WorkflowUnitTree units={await listWorkflowUnits()} />;
}

type DelegationResultsProps = { page: number; pageSize: number; canManage: boolean };

async function DelegationResults({ page, pageSize, canManage }: DelegationResultsProps) {
  if (!canManage) {
    return <DelegationsTableReadOnly data={await listDelegations({ page, pageSize })} />;
  }
  const [data, userOptions] = await Promise.all([
    listDelegations({ page, pageSize }),
    getDelegationUserOptions(),
  ]);
  return <DelegationsTableManaged data={data} userOptions={userOptions} />;
}
