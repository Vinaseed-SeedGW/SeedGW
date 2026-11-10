'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import {
  assignOrgUnitManagerInput,
  type AssignOrgUnitManagerInput,
  type ManagerOption,
  type OrgUnitRow,
} from '@dms/contracts/org-units';
import { Form } from '@dms/ui/form';
import { FormSheet } from '@dms/ui/form-sheet';
import { assignOrgUnitManagerAction } from '@/server/actions/org-units';

type AssignManagerSheetProps = {
  unit: OrgUnitRow;
  managerOptions: ManagerOption[];
  onClose: () => void;
};

export function AssignManagerSheet({ unit, managerOptions, onClose }: AssignManagerSheetProps) {
  const form = useForm<AssignOrgUnitManagerInput>({
    resolver: zodResolver(assignOrgUnitManagerInput),
    defaultValues: { id: unit.id, managerId: unit.managerId },
  });

  // Giu Truong don vi hien tai trong danh sach du nguoi nay ngoai pham vi, neu khong se bi xoa am tham.
  const options = useMemo(() => {
    const { managerId, managerName } = unit;
    if (!managerId || !managerName || managerOptions.some((o) => o.value === managerId)) {
      return managerOptions;
    }
    return [{ value: managerId, label: managerName }, ...managerOptions];
  }, [unit, managerOptions]);

  return (
    <FormSheet.Root title={`Đổi Trưởng đơn vị ${unit.name}`} onClose={onClose}>
      <Form.Root
        form={form}
        action={assignOrgUnitManagerAction}
        successMessage="Đã đổi Trưởng đơn vị"
        onSuccess={onClose}
      >
        <Form.Field name="managerId" label="Trưởng đơn vị">
          <Form.Select options={options} emptyLabel="Chưa chọn" />
        </Form.Field>
        <Form.Error />
        <Form.Actions>
          <Form.Submit>Lưu</Form.Submit>
          <FormSheet.Close>Huỷ</FormSheet.Close>
        </Form.Actions>
      </Form.Root>
    </FormSheet.Root>
  );
}
