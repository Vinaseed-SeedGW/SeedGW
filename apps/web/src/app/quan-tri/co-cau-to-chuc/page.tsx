import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ManagedOrgTree } from '@/features/org-units/components/managed-org-tree';
import { OrgTreeReadOnly } from '@/features/org-units/components/org-tree';
import { can, requirePermission } from '@/server/auth/can';
import { listManagerOptions, listOrgUnits } from '@/server/queries/org-units';

export const metadata: Metadata = { title: 'Cơ cấu tổ chức' };

export default async function OrgStructurePage() {
  const user = await requirePermission('admin.org-unit.read');

  return (
    <>
      <h1 className="text-2xl font-bold text-brand">Cơ cấu tổ chức</h1>
      <p className="mt-1 text-text-muted">
        Công ty, Miền, Vùng, Khu vực.
        {can(user, 'admin.org-unit.manage')
          ? ' Kéo một đơn vị thả vào đơn vị khác để chuyển.'
          : null}
      </p>
      <div className="mt-4">
        <Suspense fallback={<p className="text-text-muted">Đang tải cơ cấu tổ chức...</p>}>
          {can(user, 'admin.org-unit.manage') ? <ManagedResults /> : <ReadOnlyResults />}
        </Suspense>
      </div>
    </>
  );
}

async function ManagedResults() {
  const [units, managerOptions] = await Promise.all([listOrgUnits(), listManagerOptions()]);
  return <ManagedOrgTree units={units} managerOptions={managerOptions} />;
}

async function ReadOnlyResults() {
  return <OrgTreeReadOnly units={await listOrgUnits()} />;
}
