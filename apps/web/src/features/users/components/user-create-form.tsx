'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import {
  createUserInput,
  type CreatedUser,
  type CreateUserInput,
  type UserFormOptions,
} from '@seedgw/contracts/users';
import { Form } from '@seedgw/ui/form';
import { AdminPasswordFields } from '@/features/users/components/admin-password-fields';
import { UserProfileFields } from '@/features/users/components/user-profile-fields';
import { createUserAction } from '@/server/actions/users';

export function UserCreateForm({ options }: { options: UserFormOptions }) {
  const router = useRouter();
  const form = useForm<CreateUserInput>({
    resolver: zodResolver(createUserInput),
    defaultValues: {
      employeeCode: '',
      fullName: '',
      phone: '',
      email: '',
      jobTitle: '',
      hiredAt: '',
      orgUnitId: '',
      managerId: null,
      roleIds: [],
      password: '',
      confirmPassword: '',
      mustChangePassword: false,
    },
  });

  return (
    <Form.Root
      form={form}
      action={createUserAction}
      successMessage="Đã tạo tài khoản"
      onSuccess={(created: CreatedUser) => router.push(`/quan-tri/tai-khoan/${created.id}`)}
    >
      <Form.Field name="employeeCode" label="Mã nhân viên">
        <Form.Input autoComplete="off" />
      </Form.Field>
      <UserProfileFields options={options} />
      <h2 className="mt-6 text-lg font-bold">Mật khẩu đăng nhập</h2>
      <AdminPasswordFields />
      <Form.Error />
      <Form.Actions>
        <Form.Submit>Tạo tài khoản</Form.Submit>
        <Link href="/quan-tri/tai-khoan" className="px-2 text-brand">
          Huỷ
        </Link>
      </Form.Actions>
    </Form.Root>
  );
}
