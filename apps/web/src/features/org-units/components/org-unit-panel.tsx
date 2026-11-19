'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { buildOrgTree, checkOrgUnitMove, flattenOrgTree } from '@seedgw/contracts/org-tree';
import { ROUTE_KIND_HINT, ROUTE_KIND_OPTIONS } from '@seedgw/contracts/route-plans';
import {
  createOrgUnitInput,
  moveOrgUnitInput,
  updateOrgUnitInput,
  type CreateOrgUnitInput,
  type ManagerOption,
  type MoveOrgUnitInput,
  type OrgUnitRow,
  type UpdateOrgUnitInput,
} from '@seedgw/contracts/org-units';
import { ConfirmDialog } from '@seedgw/ui/confirm-dialog';
import { Form } from '@seedgw/ui/form';
import { FormSheet } from '@seedgw/ui/form-sheet';
import {
  createOrgUnitAction,
  deleteOrgUnitAction,
  moveOrgUnitAction,
  updateOrgUnitAction,
} from '@/server/actions/org-units';

export type OrgPanel =
  | { type: 'create'; parent: OrgUnitRow }
  | { type: 'edit'; unit: OrgUnitRow }
  | { type: 'move'; unit: OrgUnitRow }
  | { type: 'delete'; unit: OrgUnitRow }
  | { type: 'confirm-move'; unit: OrgUnitRow; target: OrgUnitRow };

const CODE_HINT = 'Viết liền, không dấu, ví dụ MB-VUNG1';
const LEADER_HINT =
  'Là Lãnh đạo đơn vị, người duyệt cuối Tuyến và Chỉ tiêu. Tự được gán vai trò này.';
const MANAGER_LEVEL_HINT =
  'Bật thì phiếu Tuyến, Chỉ tiêu của nhân viên qua Quản lý trực tiếp trước khi tới Lãnh đạo đơn vị.';

type FormProps = { managerOptions: ManagerOption[]; onClose: () => void };

function CreateSheet({ parent, managerOptions, onClose }: FormProps & { parent: OrgUnitRow }) {
  const form = useForm<CreateOrgUnitInput>({
    resolver: zodResolver(createOrgUnitInput),
    defaultValues: {
      parentId: parent.id,
      code: '',
      name: '',
      managerId: null,
      hasManagerLevel: false,
      routeKind: 'WEEKLY',
    },
  });

  return (
    <FormSheet.Root title={`Thêm cấp dưới của ${parent.name}`} onClose={onClose}>
      <Form.Root
        form={form}
        action={createOrgUnitAction}
        successMessage="Đã tạo đơn vị"
        onSuccess={onClose}
      >
        <Form.Field name="code" label="Mã đơn vị" hint={CODE_HINT}>
          <Form.Input autoComplete="off" />
        </Form.Field>
        <Form.Field name="name" label="Tên đơn vị">
          <Form.Input autoComplete="off" />
        </Form.Field>
        <Form.Field name="managerId" label="Trưởng đơn vị" hint={LEADER_HINT}>
          <Form.Select options={managerOptions} emptyLabel="Chưa chọn" />
        </Form.Field>
        <Form.CheckboxField
          name="hasManagerLevel"
          label="Có cấp Quản lý"
          hint={MANAGER_LEVEL_HINT}
        />
        <Form.Field name="routeKind" label="Kiểu tuyến" hint={ROUTE_KIND_HINT}>
          <Form.ChoiceSelect options={ROUTE_KIND_OPTIONS} />
        </Form.Field>
        <Form.Error />
        <Form.Actions>
          <Form.Submit>Tạo đơn vị</Form.Submit>
          <FormSheet.Close>Huỷ</FormSheet.Close>
        </Form.Actions>
      </Form.Root>
    </FormSheet.Root>
  );
}

function EditSheet({ unit, managerOptions, onClose }: FormProps & { unit: OrgUnitRow }) {
  const form = useForm<UpdateOrgUnitInput>({
    resolver: zodResolver(updateOrgUnitInput),
    defaultValues: {
      id: unit.id,
      code: unit.code,
      name: unit.name,
      managerId: unit.managerId,
      hasManagerLevel: unit.hasManagerLevel,
      routeKind: unit.routeKind,
    },
  });

  return (
    <FormSheet.Root title={`Sửa ${unit.name}`} onClose={onClose}>
      <Form.Root
        form={form}
        action={updateOrgUnitAction}
        successMessage="Đã lưu đơn vị"
        onSuccess={onClose}
      >
        <Form.Field name="code" label="Mã đơn vị" hint={CODE_HINT}>
          <Form.Input autoComplete="off" />
        </Form.Field>
        <Form.Field name="name" label="Tên đơn vị">
          <Form.Input autoComplete="off" />
        </Form.Field>
        <Form.Field name="managerId" label="Trưởng đơn vị" hint={LEADER_HINT}>
          <Form.Select options={managerOptions} emptyLabel="Chưa chọn" />
        </Form.Field>
        <Form.CheckboxField
          name="hasManagerLevel"
          label="Có cấp Quản lý"
          hint={MANAGER_LEVEL_HINT}
        />
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

type MoveSheetProps = { unit: OrgUnitRow; units: OrgUnitRow[]; onClose: () => void };

function MoveSheet({ unit, units, onClose }: MoveSheetProps) {
  const form = useForm<MoveOrgUnitInput>({
    resolver: zodResolver(moveOrgUnitInput),
    defaultValues: { id: unit.id, newParentId: '' },
  });
  const options = useMemo(
    () =>
      flattenOrgTree<OrgUnitRow>(buildOrgTree(units))
        .filter((item) => checkOrgUnitMove(units, unit.id, item.id).ok)
        .map((item) => ({ value: item.id, label: item.name })),
    [units, unit.id],
  );

  return (
    <FormSheet.Root title={`Chuyển ${unit.name}`} onClose={onClose}>
      {options.length === 0 ? (
        <>
          <p className="text-text-muted">Không có đơn vị nào phù hợp để chuyển tới.</p>
          <Form.Actions>
            <FormSheet.Close>Đóng</FormSheet.Close>
          </Form.Actions>
        </>
      ) : (
        <Form.Root
          form={form}
          action={moveOrgUnitAction}
          successMessage="Đã chuyển đơn vị"
          onSuccess={onClose}
        >
          <Form.Field name="newParentId" label="Chuyển vào đơn vị">
            <Form.Select options={options} emptyLabel="Chọn đơn vị cha" />
          </Form.Field>
          <Form.Error />
          <Form.Actions>
            <Form.Submit>Chuyển</Form.Submit>
            <FormSheet.Close>Huỷ</FormSheet.Close>
          </Form.Actions>
        </Form.Root>
      )}
    </FormSheet.Root>
  );
}

type OrgUnitPanelProps = FormProps & { panel: OrgPanel; units: OrgUnitRow[] };

export function OrgUnitPanel({ panel, units, managerOptions, onClose }: OrgUnitPanelProps) {
  switch (panel.type) {
    case 'create':
      return (
        <CreateSheet parent={panel.parent} managerOptions={managerOptions} onClose={onClose} />
      );
    case 'edit':
      return <EditSheet unit={panel.unit} managerOptions={managerOptions} onClose={onClose} />;
    case 'move':
      return <MoveSheet unit={panel.unit} units={units} onClose={onClose} />;
    case 'delete':
      return (
        <ConfirmDialog
          title="Xoá đơn vị"
          confirmLabel="Xoá"
          tone="danger"
          successMessage="Đã xoá đơn vị"
          onConfirm={() => deleteOrgUnitAction({ id: panel.unit.id })}
          onClose={onClose}
        >
          Bạn chắc chắn muốn xoá <b>{panel.unit.name}</b>?
        </ConfirmDialog>
      );
    case 'confirm-move':
      return (
        <ConfirmDialog
          title="Chuyển đơn vị"
          confirmLabel="Chuyển"
          tone="primary"
          successMessage="Đã chuyển đơn vị"
          onConfirm={() => moveOrgUnitAction({ id: panel.unit.id, newParentId: panel.target.id })}
          onClose={onClose}
        >
          Chuyển <b>{panel.unit.name}</b> vào <b>{panel.target.name}</b>? Phạm vi dữ liệu của người
          quản lý các đơn vị liên quan sẽ thay đổi theo.
        </ConfirmDialog>
      );
  }
}
