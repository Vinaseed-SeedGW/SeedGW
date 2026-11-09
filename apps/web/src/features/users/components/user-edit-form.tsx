'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import {
  updateUserInput,
  type UpdateUserInput,
  type UserDetail,
  type UserFormOptions,
} from '@dms/contracts/users';
import { Form } from '@dms/ui/form';
import { UserProfileFields } from '@/features/users/components/user-profile-fields';
import { updateUserAction } from '@/server/actions/users';

type UserEditFormProps = {
  user: UserDetail;
  options: UserFormOptions;
};

export function UserEditForm({ user, options }: UserEditFormProps) {
  const form = useForm<UpdateUserInput>({
    resolver: zodResolver(updateUserInput),
    defaultValues: {
      id: user.id,
      fullName: user.fullName,
      phone: user.phone,
      email: user.email,
      jobTitle: user.jobTitle,
      hiredAt: user.hiredAt,
      orgUnitId: user.orgUnitId ?? '',
      managerId: user.managerId,
      roleIds: user.roleIds,
    },
  });

  return (
    <Form.Root form={form} action={updateUserAction} successMessage="Đã lưu tài khoản">
      <UserProfileFields options={options} />
      <Form.Error />
      <Form.Actions>
        <Form.Submit>Lưu</Form.Submit>
        <Link href="/quan-tri/tai-khoan" className="px-2 text-brand">
          Về danh sách
        </Link>
      </Form.Actions>
    </Form.Root>
  );
}
