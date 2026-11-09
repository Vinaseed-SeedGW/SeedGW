import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FormPage } from '@dms/ui/form-page';
import { UserDevicesPanel } from '@/features/users/components/user-devices-panel';
import { UserEditForm } from '@/features/users/components/user-edit-form';
import { UserSecurityPanel } from '@/features/users/components/user-security-panel';
import { requirePermission } from '@/server/auth/can';
import { getUserDetail, getUserFormOptions } from '@/server/queries/users';

export const metadata: Metadata = { title: 'Chi tiết tài khoản' };

type PageProps = { params: Promise<{ id: string }> };

export default async function AccountDetailPage({ params }: PageProps) {
  await requirePermission('admin.user.manage');
  const { id } = await params;
  const user = await getUserDetail(id);
  if (!user) notFound();

  const options = user.allowed.edit
    ? await getUserFormOptions({ editingUserId: user.id, currentManagerId: user.managerId })
    : null;

  return (
    <FormPage title={user.fullName} backHref="/quan-tri/tai-khoan" backLabel="Tài khoản">
      <p className="mb-3.5 text-sm text-text-muted">
        Mã nhân viên: <b className="text-text">{user.employeeCode}</b>
      </p>
      {options ? (
        <UserEditForm user={user} options={options} />
      ) : (
        <p className="rounded-md bg-surface-subtle px-3 py-2">
          Tài khoản này có quyền cao hơn quyền của bạn nên không thể sửa. Vai trò hiện tại:{' '}
          {user.roleNames.join(', ')}.
        </p>
      )}
      <UserSecurityPanel user={user} />
      <UserDevicesPanel devices={user.devices} />
    </FormPage>
  );
}
