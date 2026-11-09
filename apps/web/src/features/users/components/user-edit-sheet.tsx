'use client';

import type { UserEditValues } from '@dms/contracts/users';
import { FormSheet } from '@dms/ui/form-sheet';
import { UserEditForm } from '@/features/users/components/user-edit-form';

type UserEditSheetProps = {
  user: UserEditValues;
  onClose: () => void;
};

export function UserEditSheet({ user, onClose }: UserEditSheetProps) {
  return (
    <FormSheet.Root title="Sửa tài khoản" onClose={onClose}>
      <UserEditForm user={user} onSaved={onClose}>
        <FormSheet.Close>Huỷ</FormSheet.Close>
      </UserEditForm>
    </FormSheet.Root>
  );
}
