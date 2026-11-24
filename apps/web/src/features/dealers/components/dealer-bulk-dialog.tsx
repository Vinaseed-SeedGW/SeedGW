'use client';

import { useState } from 'react';
import { userFitsUnit, type DealerFilter, type DealerFormOptions } from '@seedgw/contracts/dealers';
import { ConfirmDialog } from '@seedgw/ui/confirm-dialog';
import { bulkAssignDealersAction, bulkMoveDealersAction } from '@/server/actions/dealers';

export type BulkMode = 'ASSIGN' | 'MOVE';

type Props = {
  mode: BulkMode;
  scopeLabel: string;
  target: { filter: DealerFilter; ids: string[] };
  options: DealerFormOptions;
  onClose: () => void;
  onDone: () => void;
};

const SELECT_CLASS = 'mt-1 h-9.5 w-full rounded-md border border-input bg-surface px-2';

export function DealerBulkDialog({ mode, scopeLabel, target, options, onClose, onDone }: Props) {
  const [value, setValue] = useState('');
  const isAssign = mode === 'ASSIGN';
  // Đang lọc một đơn vị và không chọn dòng thì chỉ hiện nhân viên của đơn vị đó (K7b).
  const unitId = target.ids.length === 0 ? target.filter.orgUnitId : undefined;
  const users = unitId ? options.users.filter((user) => userFitsUnit(user, unitId)) : options.users;

  return (
    <ConfirmDialog
      title={isAssign ? 'Gán nhân viên phụ trách' : 'Đổi đơn vị phụ trách'}
      confirmLabel={isAssign ? 'Gán' : 'Đổi đơn vị'}
      tone="primary"
      successMessage={isAssign ? 'Đã gán nhân viên phụ trách' : 'Đã đổi đơn vị phụ trách'}
      onClose={onClose}
      onConfirm={async () => {
        if (!isAssign && !value) return { ok: false, message: 'Chọn đơn vị phụ trách' };
        const result = isAssign
          ? await bulkAssignDealersAction({ ...target, assignedUserId: value || null })
          : await bulkMoveDealersAction({ ...target, orgUnitId: value });
        if (result.ok) onDone();
        return result;
      }}
    >
      <p>Áp dụng cho {scopeLabel}.</p>
      <label className="mt-3 block text-sm font-bold">
        {isAssign ? 'Nhân viên phụ trách' : 'Đơn vị phụ trách mới'}
        <select className={SELECT_CLASS} value={value} onChange={(e) => setValue(e.target.value)}>
          <option value="">{isAssign ? 'Bỏ gán, để chờ gán' : 'Chọn đơn vị'}</option>
          {(isAssign ? users : options.orgUnits).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <p className="mt-2 text-sm text-text-muted">
        {isAssign
          ? 'Nhân viên chỉ phụ trách đại lý của đơn vị mình (hoặc đơn vị cấp trên). Đại lý của đơn vị khác trong số đã chọn được bỏ qua.'
          : 'Nhân viên phụ trách không thuộc đơn vị mới sẽ được bỏ gán để gán lại. Đổi tên, mã hoặc vị trí của đơn vị thì sửa ở trang Cơ cấu tổ chức.'}
      </p>
    </ConfirmDialog>
  );
}
