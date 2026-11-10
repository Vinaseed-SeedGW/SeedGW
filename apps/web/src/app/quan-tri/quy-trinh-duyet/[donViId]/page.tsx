import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { z } from 'zod';
import { WorkflowHistory } from '@/features/workflows/components/workflow-history';
import { WorkflowManager } from '@/features/workflows/components/workflow-manager';
import { WorkflowPreviewPanel } from '@/features/workflows/components/workflow-preview';
import { WorkflowSourceNote } from '@/features/workflows/components/workflow-source-note';
import { WorkflowStepsReadOnly } from '@/features/workflows/components/workflow-steps-read-only';
import { requirePermission } from '@/server/auth/can';
import { getWorkflowDetail, getWorkflowFormOptions } from '@/server/queries/workflows';

export const metadata: Metadata = { title: 'Quy trình duyệt của đơn vị' };

type PageProps = { params: Promise<{ donViId: string }> };

export default async function WorkflowDetailPage({ params }: PageProps) {
  await requirePermission('admin.workflow.read');
  const { donViId } = await params;
  if (!z.uuid().safeParse(donViId).success) notFound();

  return (
    <div className="max-w-4xl">
      <Link href="/quan-tri/quy-trinh-duyet" className="text-sm text-brand">
        Quy trình duyệt
      </Link>
      <Suspense fallback={<p className="mt-4 text-text-muted">Đang tải quy trình...</p>}>
        <WorkflowDetailResults orgUnitId={donViId} />
      </Suspense>
    </div>
  );
}

async function WorkflowDetailResults({ orgUnitId }: { orgUnitId: string }) {
  const [detail, options] = await Promise.all([
    getWorkflowDetail(orgUnitId),
    getWorkflowFormOptions(),
  ]);
  if (!detail) notFound();

  const activeSteps = detail.own?.steps ?? detail.inherited?.steps ?? [];

  return (
    <>
      <h1 className="mt-1 text-2xl font-bold text-brand">{detail.unit.name}</h1>
      <p className="mt-1 mb-3.5 text-sm text-text-muted">Mã đơn vị: {detail.unit.code}</p>
      {detail.canManage ? (
        // Dat lai form sau moi lan luu de so sanh dung voi phien ban moi.
        <WorkflowManager key={detail.own?.version ?? 'ke-thua'} detail={detail} options={options} />
      ) : (
        <>
          <WorkflowSourceNote own={detail.own} inherited={detail.inherited} />
          {activeSteps.length > 0 ? (
            <div className="mt-3">
              <WorkflowStepsReadOnly steps={activeSteps} />
            </div>
          ) : null}
          <WorkflowPreviewPanel options={options} defaultOrgUnitId={detail.unit.id} />
        </>
      )}
      <WorkflowHistory versions={detail.history} />
    </>
  );
}
