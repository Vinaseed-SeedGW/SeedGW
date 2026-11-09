import type { Metadata } from 'next';
import { FormPage } from '@dms/ui/form-page';
import { UserCreateForm } from '@/features/users/components/user-create-form';
import { requirePermission } from '@/server/auth/can';
import { getUserFormOptions } from '@/server/queries/users';

export const metadata: Metadata = { title: 'Tạo tài khoản' };

export default async function CreateAccountPage() {
  await requirePermission('admin.user.manage');
  const options = await getUserFormOptions({ editingUserId: null, currentManagerId: null });

  return (
    <FormPage title="Tạo tài khoản" backHref="/quan-tri/tai-khoan" backLabel="Tài khoản">
      <UserCreateForm options={options} />
    </FormPage>
  );
}
