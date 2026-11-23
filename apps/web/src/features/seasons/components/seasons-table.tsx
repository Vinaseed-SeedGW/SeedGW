'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { formatNumber } from '@seedgw/contracts/format';
import { upsertSeasonInput, type SeasonRow } from '@seedgw/contracts/seasons';
import { ConfirmDialog } from '@seedgw/ui/confirm-dialog';
import { DataTable, type ColumnDef } from '@seedgw/ui/data-table';
import { Form } from '@seedgw/ui/form';
import { FormSheet } from '@seedgw/ui/form-sheet';
import { deleteSeasonAction, upsertSeasonAction } from '@/server/actions/seasons';

type FormValues = z.input<typeof upsertSeasonInput>;
type Editing =
  { kind: 'create' } | { kind: 'edit'; row: SeasonRow } | { kind: 'delete'; row: SeasonRow };

const BUTTON =
  'inline-flex h-9.5 items-center rounded-md border border-border bg-surface px-3 font-bold hover:bg-brand-soft';

function displayDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

function columns(canManage: boolean, onEdit: (editing: Editing) => void): ColumnDef<SeasonRow>[] {
  return [
    {
      accessorKey: 'name',
      header: 'Vụ',
      meta: { label: 'Vụ' },
      cell: ({ row }) => <span className="font-bold">{row.original.name}</span>,
    },
    {
      id: 'range',
      header: 'Thời gian',
      meta: { label: 'Thời gian' },
      cell: ({ row }) =>
        `${displayDate(row.original.startDate)} tới ${displayDate(row.original.endDate)}, ${formatNumber(row.original.days)} ngày`,
    },
    {
      accessorKey: 'note',
      header: 'Ghi chú',
      meta: { label: 'Ghi chú', className: 'max-md:hidden min-w-48 whitespace-normal!' },
    },
    ...(canManage
      ? [
          {
            id: 'actions',
            header: 'Xử lý',
            meta: { label: 'Xử lý' },
            cell: ({ row }) => (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={BUTTON}
                  onClick={() => onEdit({ kind: 'edit', row: row.original })}
                >
                  Sửa
                </button>
                <button
                  type="button"
                  className={BUTTON}
                  onClick={() => onEdit({ kind: 'delete', row: row.original })}
                >
                  Xoá
                </button>
              </div>
            ),
          } satisfies ColumnDef<SeasonRow>,
        ]
      : []),
  ];
}

function SeasonSheet({ row, onClose }: { row: SeasonRow | null; onClose: () => void }) {
  const form = useForm<FormValues>({
    resolver: zodResolver(upsertSeasonInput),
    defaultValues: {
      id: row?.id ?? null,
      name: row?.name ?? '',
      startDate: row?.startDate ?? '',
      endDate: row?.endDate ?? '',
      note: row?.note ?? '',
    },
  });
  return (
    <FormSheet.Root title={row ? 'Sửa vụ' : 'Thêm vụ'} onClose={onClose}>
      <Form.Root
        form={form}
        action={upsertSeasonAction}
        successMessage="Đã lưu vụ"
        onSuccess={onClose}
      >
        <Form.Field name="name" label="Tên vụ" hint="Ví dụ: Đông Xuân 2026-2027">
          <Form.Input maxLength={100} autoComplete="off" />
        </Form.Field>
        <Form.Field name="startDate" label="Từ ngày">
          <Form.DateInput />
        </Form.Field>
        <Form.Field name="endDate" label="Đến ngày">
          <Form.DateInput />
        </Form.Field>
        <Form.Field name="note" label="Ghi chú (không bắt buộc)">
          <Form.Input maxLength={500} />
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

function getId(row: SeasonRow) {
  return row.id;
}

export function SeasonsTable({ rows, canManage }: { rows: SeasonRow[]; canManage: boolean }) {
  const [editing, setEditing] = useState<Editing | null>(null);
  const close = () => setEditing(null);
  return (
    <>
      {canManage ? (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setEditing({ kind: 'create' })}
            className="inline-flex h-9.5 items-center rounded-md bg-brand px-3 font-bold text-primary-foreground hover:bg-brand-hover"
          >
            Thêm vụ
          </button>
        </div>
      ) : null}
      <DataTable.Root
        columns={columns(canManage, setEditing)}
        data={rows}
        getRowId={getId}
        total={rows.length}
        page={1}
        pageSize={Math.max(rows.length, 1)}
      >
        <DataTable.Body emptyMessage="Chưa khai báo vụ nào. Bấm Thêm vụ để khai báo tên và thời gian từng vụ." />
      </DataTable.Root>
      {editing?.kind === 'create' ? <SeasonSheet row={null} onClose={close} /> : null}
      {editing?.kind === 'edit' ? <SeasonSheet row={editing.row} onClose={close} /> : null}
      {editing?.kind === 'delete' ? (
        <ConfirmDialog
          title="Xoá vụ"
          confirmLabel="Xoá"
          tone="danger"
          successMessage="Đã xoá vụ"
          onClose={close}
          onConfirm={() => deleteSeasonAction({ id: editing.row.id })}
        >
          <p>
            Xoá vụ <b>{editing.row.name}</b>. Dashboard và Báo cáo không chọn được vụ này nữa; số
            liệu check-in không đổi.
          </p>
        </ConfirmDialog>
      ) : null}
    </>
  );
}
