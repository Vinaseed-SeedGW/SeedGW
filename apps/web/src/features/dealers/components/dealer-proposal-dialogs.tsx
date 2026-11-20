'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import {
  approveDealerProposalInput,
  DUPLICATE_REASON_LABEL,
  type DealerProposalOptions,
  type DealerProposalRow,
} from '@seedgw/contracts/dealer-proposals';
import { DEALER_LEVEL_LABEL, DEALER_LEVELS } from '@seedgw/contracts/dealers';
import { formatNumber } from '@seedgw/contracts/format';
import { ConfirmDialog } from '@seedgw/ui/confirm-dialog';
import { Form } from '@seedgw/ui/form';
import { FormSheet } from '@seedgw/ui/form-sheet';
import {
  approveDealerProposalAction,
  markDuplicateDealerProposalAction,
  rejectDealerProposalAction,
} from '@/server/actions/dealer-proposals';

type ApproveValues = z.input<typeof approveDealerProposalInput>;

const LEVEL_OPTIONS = DEALER_LEVELS.map((level) => ({
  value: String(level),
  label: DEALER_LEVEL_LABEL[level],
}));

type DialogProps = { row: DealerProposalRow; onClose: () => void };

/** Người duyệt sửa lại thông tin rồi tạo đại lý. Đơn vị và nhân viên mặc định theo người đề xuất. */
export function ApproveProposalSheet({
  row,
  options,
  onClose,
}: DialogProps & { options: DealerProposalOptions }) {
  const unitAllowed = options.orgUnits.some((unit) => unit.value === row.orgUnitId);
  const proposerAllowed = options.users.some((user) => user.value === row.proposedById);
  const form = useForm<ApproveValues>({
    resolver: zodResolver(approveDealerProposalInput),
    defaultValues: {
      id: row.id,
      name: row.name,
      phone: row.phone,
      address: row.address,
      ownerName: row.ownerName ?? '',
      taxCode: row.taxCode ?? '',
      level: String(row.level),
      orgUnitId: unitAllowed && row.orgUnitId ? row.orgUnitId : '',
      assignedUserId: proposerAllowed ? row.proposedById : null,
    },
  });

  return (
    <FormSheet.Root title="Duyệt đại lý mới" onClose={onClose}>
      <p className="mb-3 text-sm text-text-muted">
        Tạo đại lý với toạ độ lúc chụp. Lượt check-in kèm đề xuất được tính là lượt ghé thăm đại lý
        này. Đại lý chưa có mã FAST cho tới khi nối FAST hai chiều.
      </p>
      <Form.Root
        form={form}
        action={approveDealerProposalAction}
        successMessage="Đã tạo đại lý mới"
        onSuccess={onClose}
      >
        <Form.Field name="name" label="Tên đại lý">
          <Form.Input autoComplete="off" />
        </Form.Field>
        <Form.Field name="phone" label="Số điện thoại">
          <Form.Input inputMode="tel" autoComplete="off" />
        </Form.Field>
        <Form.Field name="address" label="Địa chỉ">
          <Form.Input autoComplete="off" />
        </Form.Field>
        <Form.Field name="ownerName" label="Chủ đại lý">
          <Form.Input autoComplete="off" />
        </Form.Field>
        <Form.Field name="taxCode" label="Mã số thuế">
          <Form.Input inputMode="numeric" autoComplete="off" />
        </Form.Field>
        <Form.Field name="level" label="Cấp đại lý">
          <Form.ChoiceSelect options={LEVEL_OPTIONS} />
        </Form.Field>
        <Form.Field name="orgUnitId" label="Đơn vị phụ trách">
          <Form.Select options={options.orgUnits} emptyLabel="Chọn đơn vị" />
        </Form.Field>
        <Form.Field name="assignedUserId" label="Nhân viên phụ trách">
          <Form.Select options={options.users} emptyLabel="Chưa giao" />
        </Form.Field>
        <Form.Error />
        <Form.Actions>
          <Form.Submit>Tạo đại lý</Form.Submit>
          <FormSheet.Close>Huỷ</FormSheet.Close>
        </Form.Actions>
      </Form.Root>
    </FormSheet.Root>
  );
}

export function RejectProposalDialog({ row, onClose }: DialogProps) {
  const [note, setNote] = useState('');
  return (
    <ConfirmDialog
      title="Từ chối đề xuất đại lý mới"
      confirmLabel="Từ chối"
      tone="danger"
      successMessage="Đã từ chối đề xuất"
      onClose={onClose}
      onConfirm={() => rejectDealerProposalAction({ id: row.id, note })}
    >
      <p>
        Không tạo đại lý <b>{row.name}</b>. Nhân viên nhận thông báo kèm lý do trên app.
      </p>
      <label className="mt-3 block font-bold" htmlFor="reject-note">
        Lý do (từ 5 tới 500 ký tự)
      </label>
      <textarea
        id="reject-note"
        value={note}
        maxLength={500}
        onChange={(event) => setNote(event.target.value)}
        className="mt-1 min-h-20 w-full rounded-md border border-border bg-surface p-2"
      />
    </ConfirmDialog>
  );
}

/** Đề xuất trùng một đại lý có sẵn: chọn đại lý đó, lượt check-in được gắn vào đại lý này. */
export function DuplicateProposalDialog({ row, onClose }: DialogProps) {
  const [dealerId, setDealerId] = useState(row.duplicates[0]?.id ?? '');
  const [note, setNote] = useState('');
  return (
    <ConfirmDialog
      title="Trùng đại lý có sẵn"
      confirmLabel="Đánh dấu trùng"
      tone="primary"
      successMessage="Đã gắn lượt check-in vào đại lý có sẵn"
      onClose={onClose}
      onConfirm={() => markDuplicateDealerProposalAction({ id: row.id, dealerId, note })}
    >
      <p>
        Không tạo đại lý mới cho <b>{row.name}</b>. Lượt check-in kèm đề xuất được tính là lượt ghé
        thăm đại lý chọn dưới đây.
      </p>
      <fieldset className="mt-3">
        <legend className="font-bold">Đại lý có sẵn</legend>
        {row.duplicates.map((candidate) => (
          <label key={candidate.id} className="mt-2 flex gap-2">
            <input
              type="radio"
              name="duplicate-dealer"
              value={candidate.id}
              checked={dealerId === candidate.id}
              onChange={() => setDealerId(candidate.id)}
              className="mt-1"
            />
            <span>
              <span className="font-bold">{candidate.name}</span>
              <span className="block text-sm text-text-muted">{candidate.address}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <label className="mt-3 block font-bold" htmlFor="duplicate-note">
        Ghi chú
      </label>
      <textarea
        id="duplicate-note"
        value={note}
        maxLength={500}
        onChange={(event) => setNote(event.target.value)}
        className="mt-1 min-h-16 w-full rounded-md border border-border bg-surface p-2"
      />
    </ConfirmDialog>
  );
}

export function DuplicateList({ row }: { row: DealerProposalRow }) {
  if (row.duplicates.length === 0) {
    return <span className="text-sm text-text-muted">Không thấy đại lý trùng</span>;
  }
  return (
    <ul className="space-y-1">
      {row.duplicates.map((candidate) => (
        <li key={candidate.id}>
          <a
            href={`/quan-tri/dai-ly/${candidate.id}`}
            target="_blank"
            rel="noreferrer"
            className="font-bold text-brand"
          >
            {candidate.name}
          </a>
          <span className="block text-sm text-text-muted">
            {candidate.reasons.map((reason) => DUPLICATE_REASON_LABEL[reason]).join(', ')}
            {candidate.distanceM !== null ? `, cách ${formatNumber(candidate.distanceM)} m` : ''}
          </span>
        </li>
      ))}
    </ul>
  );
}
