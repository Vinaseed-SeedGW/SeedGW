'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { vietnamToday } from '@dms/contracts/format';
import {
  ASSIGNMENT_TARGET_OPTIONS,
  INHERIT_SHIFT_VALUE,
  createAssignmentInput,
  type AssignmentTarget,
  type CreateAssignmentForm,
  type CreateAssignmentInput,
  type ShiftFormOptions,
} from '@dms/contracts/shifts';
import { Form } from '@dms/ui/form';
import { FormSheet } from '@dms/ui/form-sheet';
import { createAssignmentAction } from '@/server/actions/shifts';

function TargetField({ options }: { options: ShiftFormOptions }) {
  const target = useWatch({ name: 'target' }) as AssignmentTarget;
  return target === 'ORG_UNIT' ? (
    <Form.Field
      key={target}
      name="orgUnitId"
      label="Đơn vị"
      hint="Đơn vị con chưa gán ca riêng sẽ dùng ca này."
    >
      <Form.Select options={options.units} emptyLabel="Chọn đơn vị" />
    </Form.Field>
  ) : (
    <Form.Field
      key={target}
      name="userId"
      label="Nhân viên"
      hint="Gán riêng được ưu tiên hơn ca của đơn vị."
    >
      <Form.Select options={options.users} emptyLabel="Chọn nhân viên" />
    </Form.Field>
  );
}

type AssignmentSheetProps = { options: ShiftFormOptions; onClose: () => void };

export function AssignmentSheet({ options, onClose }: AssignmentSheetProps) {
  const form = useForm<CreateAssignmentForm, unknown, CreateAssignmentInput>({
    resolver: zodResolver(createAssignmentInput),
    defaultValues: {
      target: 'ORG_UNIT',
      orgUnitId: null,
      userId: null,
      shiftId: '',
      effectiveFrom: vietnamToday(),
    },
  });
  const shiftOptions = useMemo(
    () => [
      ...options.shifts,
      { value: INHERIT_SHIFT_VALUE, label: 'Bỏ gán riêng, theo đơn vị cấp trên' },
    ],
    [options.shifts],
  );

  return (
    <FormSheet.Root title="Gán ca" onClose={onClose}>
      <Form.Root
        form={form}
        action={createAssignmentAction}
        successMessage="Đã gán ca"
        onSuccess={onClose}
      >
        <Form.Field name="target" label="Gán cho">
          <Form.ChoiceSelect options={ASSIGNMENT_TARGET_OPTIONS} />
        </Form.Field>
        <TargetField options={options} />
        <Form.Field name="shiftId" label="Ca">
          <Form.Select options={shiftOptions} emptyLabel="Chọn ca" />
        </Form.Field>
        <Form.Field
          name="effectiveFrom"
          label="Áp dụng từ ngày"
          hint="Ca cũ vẫn dùng cho các ngày trước ngày này."
        >
          <Form.DateInput />
        </Form.Field>
        <Form.Error />
        <Form.Actions>
          <Form.Submit>Gán ca</Form.Submit>
          <FormSheet.Close>Huỷ</FormSheet.Close>
        </Form.Actions>
      </Form.Root>
    </FormSheet.Root>
  );
}
