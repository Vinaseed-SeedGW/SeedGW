'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  createUserInput,
  type CreatedUser,
  type CreateUserInput,
  type UserFormOptions,
} from '@dms/contracts/users';
import { Form } from '@dms/ui/form';
import { TemporaryPasswordDialog } from '@/features/users/components/temporary-password-dialog';
import { UserProfileFields } from '@/features/users/components/user-profile-fields';
import { createUserAction } from '@/server/actions/users';

export function UserCreateForm({ options }: { options: UserFormOptions }) {
  const router = useRouter();
  const [created, setCreated] = useState<CreatedUser | null>(null);
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
    },
  });

  return (
    <>
      <Form.Root
        form={form}
        action={createUserAction}
        successMessage="Đã tạo tài khoản"
        onSuccess={setCreated}
      >
        <Form.Field name="employeeCode" label="Mã nhân viên">
          <Form.Input autoComplete="off" />
        </Form.Field>
        <UserProfileFields options={options} />
        <Form.Error />
        <Form.Actions>
          <Form.Submit>Tạo tài khoản</Form.Submit>
          <Link href="/quan-tri/tai-khoan" className="px-2 text-brand">
            Huỷ
          </Link>
        </Form.Actions>
      </Form.Root>
      {created ? (
        <TemporaryPasswordDialog
          title="Mật khẩu tạm của tài khoản mới"
          employeeCode={created.employeeCode}
          password={created.temporaryPassword}
          onClose={() => router.push(`/quan-tri/tai-khoan/${created.id}`)}
        />
      ) : null}
    </>
  );
}
