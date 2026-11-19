'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import {
  assignOrgUnitManagerInput,
  type AssignOrgUnitManagerInput,
  type ManagerOption,
  type OrgUnitRow,
} from '@seedgw/contracts/org-units';
import { ROUTE_KIND_HINT, ROUTE_KIND_OPTIONS } from '@seedgw/contracts/route-plans';
import { Form } from '@seedgw/ui/form';
import { FormSheet } from '@seedgw/ui/form-sheet';
import { assignOrgUnitManagerAction } from '@/server/actions/org-units';

type AssignManagerSheetProps = {
  unit: OrgUnitRow;
  managerOptions: ManagerOption[];
  onClose: () => void;
};

export function AssignManagerSheet({ unit, managerOptions, onClose }: AssignManagerSheetProps) {
  const form = useForm<AssignOrgUnitManagerInput>({
    resolver: zodResolver(assignOrgUnitManagerInput),
    defaultValues: { id: unit.id, managerId: unit.managerId, routeKind: unit.routeKind },
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
    <FormSheet.Root title={`Trưởng đơn vị, kiểu tuyến của ${unit.name}`} onClose={onClose}>
      <Form.Root
        form={form}
        action={assignOrgUnitManagerAction}
        successMessage="Đã lưu đơn vị"
        onSuccess={onClose}
      >
        <Form.Field name="managerId" label="Trưởng đơn vị">
          <Form.Select options={options} emptyLabel="Chưa chọn" />
        </Form.Field>
        <Form.Field name="routeKind" label="Kiểu tuyến" hint={ROUTE_KIND_HINT}>
          <Form.ChoiceSelect options={ROUTE_KIND_OPTIONS} />
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
