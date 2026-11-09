'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { updateUserInput, type UpdateUserInput, type UserEditValues } from '@dms/contracts/users';
import { Form } from '@dms/ui/form';
import { updateUserAction } from '@/server/actions/users';

type UserEditFormProps = {
  user: UserEditValues;
  onSaved?: () => void;
  children?: ReactNode;
};

export function UserEditForm({ user, onSaved, children }: UserEditFormProps) {
  const form = useForm<UpdateUserInput>({
    resolver: zodResolver(updateUserInput),
    defaultValues: { id: user.id, fullName: user.fullName, isActive: user.isActive },
  });

  return (
    <Form.Root
      form={form}
      action={updateUserAction}
      successMessage="Đã lưu tài khoản"
      onSuccess={onSaved}
    >
      <p className="mb-3.5 text-sm text-text-muted">
        Mã nhân viên: <b className="text-text">{user.employeeCode}</b>
      </p>
      <Form.Field name="fullName" label="Họ tên">
        <Form.Input autoComplete="off" />
      </Form.Field>
      <Form.CheckboxField
        name="isActive"
        label="Đang hoạt động"
        hint="Bỏ chọn để khoá tài khoản, người dùng sẽ bị đăng xuất ở lần mở trang tiếp theo."
      />
      <Form.Error />
      <Form.Actions>
        <Form.Submit>Lưu</Form.Submit>
        {children}
      </Form.Actions>
    </Form.Root>
  );
}
