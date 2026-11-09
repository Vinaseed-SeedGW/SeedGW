'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { changePasswordInput, type ChangePasswordInput } from '@dms/contracts/auth';
import { Form } from '@dms/ui/form';
import { changePasswordAction } from '@/server/actions/auth';

export function ChangePasswordForm() {
  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordInput),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  return (
    <div className="mt-3.5">
      <Form.Root form={form} action={changePasswordAction} successMessage="Đã đổi mật khẩu">
        <Form.Field name="currentPassword" label="Mật khẩu hiện tại">
          <Form.Input type="password" autoComplete="current-password" />
        </Form.Field>
        <Form.Field
          name="newPassword"
          label="Mật khẩu mới"
          hint="Ít nhất 8 ký tự, có chữ cái và chữ số, không chứa mã nhân viên."
        >
          <Form.Input type="password" autoComplete="new-password" />
        </Form.Field>
        <Form.Field name="confirmPassword" label="Nhập lại mật khẩu mới">
          <Form.Input type="password" autoComplete="new-password" />
        </Form.Field>
        <Form.Error />
        <Form.Actions>
          <Form.Submit>Đổi mật khẩu</Form.Submit>
        </Form.Actions>
      </Form.Root>
    </div>
  );
}
