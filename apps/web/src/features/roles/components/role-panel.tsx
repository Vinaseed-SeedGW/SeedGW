'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import {
  DATA_SCOPE_OPTIONS,
  createRoleInput,
  type CreateRoleInput,
  type RoleMatrixRole,
} from '@seedgw/contracts/roles';
import { ConfirmDialog } from '@seedgw/ui/confirm-dialog';
import { Form } from '@seedgw/ui/form';
import { FormSheet } from '@seedgw/ui/form-sheet';
import { createRoleAction, deleteRoleAction } from '@/server/actions/roles';

export type RolePanelState = { type: 'create' } | { type: 'delete'; role: RoleMatrixRole };

function CreateRoleSheet({ onClose }: { onClose: () => void }) {
  const form = useForm<CreateRoleInput>({
    resolver: zodResolver(createRoleInput),
    defaultValues: { code: '', name: '', dataScope: 'OWN' },
  });

  return (
    <FormSheet.Root title="Tạo vai trò" onClose={onClose}>
      <Form.Root
        form={form}
        action={createRoleAction}
        successMessage="Đã tạo vai trò"
        onSuccess={onClose}
      >
        <Form.Field
          name="code"
          label="Mã vai trò"
          hint="Viết liền, không dấu, ví dụ giam-doc-mien. Dùng khi nhập tài khoản từ Excel."
        >
          <Form.Input autoComplete="off" />
        </Form.Field>
        <Form.Field name="name" label="Tên vai trò">
          <Form.Input autoComplete="off" />
        </Form.Field>
        <Form.Field name="dataScope" label="Phạm vi dữ liệu">
          <Form.Select options={DATA_SCOPE_OPTIONS} emptyLabel="Chọn phạm vi" />
        </Form.Field>
        <Form.Error />
        <Form.Actions>
          <Form.Submit>Tạo vai trò</Form.Submit>
          <FormSheet.Close>Huỷ</FormSheet.Close>
        </Form.Actions>
      </Form.Root>
    </FormSheet.Root>
  );
}

export function RolePanel({ panel, onClose }: { panel: RolePanelState; onClose: () => void }) {
  if (panel.type === 'create') return <CreateRoleSheet onClose={onClose} />;

  return (
    <ConfirmDialog
      title="Xoá vai trò"
      confirmLabel="Xoá"
      tone="danger"
      successMessage="Đã xoá vai trò"
      onConfirm={() => deleteRoleAction({ id: panel.role.id })}
      onClose={onClose}
    >
      Bạn chắc chắn muốn xoá vai trò <b>{panel.role.name}</b>?
    </ConfirmDialog>
  );
}
