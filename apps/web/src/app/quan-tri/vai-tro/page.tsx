import type { Metadata } from 'next';
import { Suspense } from 'react';
import { RoleMatrixEditor } from '@/features/roles/components/role-matrix-editor';
import { RoleMatrixReadOnly } from '@/features/roles/components/role-matrix-read-only';
import { can, requirePermission } from '@/server/auth/can';
import { getRoleMatrix } from '@/server/queries/roles';

export const metadata: Metadata = { title: 'Vai trò và quyền' };

export default async function RolesPage() {
  const user = await requirePermission('admin.role.read');

  return (
    <>
      <h1 className="text-2xl font-bold text-brand">Vai trò và quyền</h1>
      <p className="mt-1 text-text-muted">
        Quyền có hiệu lực ngay ở lần thao tác tiếp theo của người dùng.
      </p>
      <div className="mt-4">
        <Suspense fallback={<p className="text-text-muted">Đang tải vai trò...</p>}>
          {can(user, 'admin.role.manage') ? <EditorResults /> : <ReadOnlyResults />}
        </Suspense>
      </div>
    </>
  );
}

async function EditorResults() {
  const roles = await getRoleMatrix();
  // Dat lai bang sau moi lan luu de ban nhap khop du lieu moi tu may chu.
  const version = roles.map((role) => role.updatedAt).join('|');
  return <RoleMatrixEditor key={version} roles={roles} />;
}

async function ReadOnlyResults() {
  return <RoleMatrixReadOnly roles={await getRoleMatrix()} />;
}
