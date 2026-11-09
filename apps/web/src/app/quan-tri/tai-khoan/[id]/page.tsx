import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FormPage } from '@dms/ui/form-page';
import { UserEditPageForm } from '@/features/users/components/user-edit-page-form';
import { requirePermission } from '@/server/auth/can';
import { getUserForEdit } from '@/server/queries/users';

export const metadata: Metadata = { title: 'Sửa tài khoản' };

type PageProps = { params: Promise<{ id: string }> };

export default async function AccountDetailPage({ params }: PageProps) {
  await requirePermission('admin.user.manage');
  const { id } = await params;
  const user = await getUserForEdit(id);
  if (!user) notFound();

  return (
    <FormPage title="Sửa tài khoản" backHref="/quan-tri/tai-khoan" backLabel="Tài khoản">
      <UserEditPageForm user={user} />
    </FormPage>
  );
}
