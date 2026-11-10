'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import {
  createDelegationInput,
  type CreateDelegationInput,
  type SelectOption,
} from '@dms/contracts/workflows';
import { Form } from '@dms/ui/form';
import { FormSheet } from '@dms/ui/form-sheet';
import { createDelegationAction } from '@/server/actions/workflows';

type DelegationSheetProps = { userOptions: SelectOption[]; onClose: () => void };

export function DelegationSheet({ userOptions, onClose }: DelegationSheetProps) {
  const form = useForm<CreateDelegationInput>({
    resolver: zodResolver(createDelegationInput),
    defaultValues: { delegatorId: '', delegateId: '', startDate: '', endDate: '', reason: '' },
  });

  return (
    <FormSheet.Root title="Tạo uỷ quyền" onClose={onClose}>
      <Form.Root
        form={form}
        action={createDelegationAction}
        successMessage="Đã tạo uỷ quyền"
        onSuccess={onClose}
      >
        <Form.Field name="delegatorId" label="Người vắng">
          <Form.Select options={userOptions} emptyLabel="Chọn người vắng" />
        </Form.Field>
        <Form.Field
          name="delegateId"
          label="Người nhận uỷ quyền"
          hint="Người này duyệt thay trong thời gian uỷ quyền."
        >
          <Form.Select options={userOptions} emptyLabel="Chọn người nhận" />
        </Form.Field>
        <Form.Field name="startDate" label="Từ ngày">
          <Form.DateInput />
        </Form.Field>
        <Form.Field name="endDate" label="Đến ngày">
          <Form.DateInput />
        </Form.Field>
        <Form.Field name="reason" label="Lý do">
          <Form.Input autoComplete="off" />
        </Form.Field>
        <Form.Error />
        <Form.Actions>
          <Form.Submit>Tạo uỷ quyền</Form.Submit>
          <FormSheet.Close>Huỷ</FormSheet.Close>
        </Form.Actions>
      </Form.Root>
    </FormSheet.Root>
  );
}
