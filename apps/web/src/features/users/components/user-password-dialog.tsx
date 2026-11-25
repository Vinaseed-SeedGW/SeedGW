'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { setUserPasswordInput, type SetUserPasswordInput } from '@seedgw/contracts/users';
import { Form } from '@seedgw/ui/form';
import { useModalDialog } from '@seedgw/ui/use-modal-dialog';
import { AdminPasswordFields } from '@/features/users/components/admin-password-fields';
import { setUserPasswordAction } from '@/server/actions/users';

type UserPasswordDialogProps = {
  userId: string;
  fullName: string;
  onClose: () => void;
};

export function UserPasswordDialog({ userId, fullName, onClose }: UserPasswordDialogProps) {
  const { dialogRef, attachDialog } = useModalDialog();
  const form = useForm<SetUserPasswordInput>({
    resolver: zodResolver(setUserPasswordInput),
    defaultValues: { id: userId, password: '', confirmPassword: '', mustChangePassword: false },
  });
  const close = () => dialogRef.current?.close();

  return (
    <dialog
      ref={attachDialog}
      aria-label="Đặt lại mật khẩu"
      onClose={onClose}
      className="m-auto w-full max-w-md rounded-md bg-surface p-5 text-text backdrop:bg-(--overlay)"
    >
      <h2 className="text-lg font-bold text-brand">Đặt lại mật khẩu</h2>
      <p className="mt-2 mb-3.5">
        Mật khẩu cũ của {fullName} hết hiệu lực, các phiên đang mở trên web và app bị đăng xuất.
      </p>
      <Form.Root
        form={form}
        action={setUserPasswordAction}
        successMessage="Đã đặt lại mật khẩu"
        onSuccess={close}
      >
        <AdminPasswordFields />
        <Form.Error />
        <Form.Actions>
          <Form.Submit>Đặt lại</Form.Submit>
          <button type="button" className="px-2 text-brand" onClick={close}>
            Huỷ
          </button>
        </Form.Actions>
      </Form.Root>
    </dialog>
  );
}
