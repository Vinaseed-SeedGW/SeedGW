'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { formatNumber } from '@seedgw/contracts/format';
import type { RegionOption } from '@seedgw/contracts/regions';
import {
  formatDayMonth,
  seasonRangeText,
  seasonFormInput,
  type SeasonRow,
} from '@seedgw/contracts/seasons';
import { ConfirmDialog } from '@seedgw/ui/confirm-dialog';
import { DataTable, type ColumnDef } from '@seedgw/ui/data-table';
import { Form } from '@seedgw/ui/form';
import { FormSheet } from '@seedgw/ui/form-sheet';
import { deleteSeasonAction, upsertSeasonAction } from '@/server/actions/seasons';

type FormValues = z.input<typeof seasonFormInput>;
type Editing =
  { kind: 'create' } | { kind: 'edit'; row: SeasonRow } | { kind: 'delete'; row: SeasonRow };

const BUTTON =
  'inline-flex h-9.5 items-center rounded-md border border-border bg-surface px-3 font-bold hover:bg-brand-soft';

function columns(canManage: boolean, onEdit: (editing: Editing) => void): ColumnDef<SeasonRow>[] {
  return [
    {
      accessorKey: 'name',
      header: 'Vụ',
      meta: { label: 'Vụ' },
      cell: ({ row }) => <span className="font-bold">{row.original.name}</span>,
    },
    {
      id: 'region',
      header: 'Vùng',
      meta: { label: 'Vùng' },
      cell: ({ row }) => row.original.regionName ?? 'Mọi vùng',
    },
    {
      id: 'range',
      header: 'Thời gian, mọi năm',
      meta: { label: 'Thời gian' },
      cell: ({ row }) =>
        `${seasonRangeText(row.original)}, ${formatNumber(row.original.days)} ngày`,
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

type SheetProps = { row: SeasonRow | null; regions: RegionOption[]; onClose: () => void };

function SeasonSheet({ row, regions, onClose }: SheetProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(seasonFormInput),
    defaultValues: {
      id: row?.id ?? null,
      name: row?.name ?? '',
      regionId: row?.regionId ?? null,
      start: row ? formatDayMonth(row.startDay, row.startMonth) : '',
      end: row ? formatDayMonth(row.endDay, row.endMonth) : '',
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
        <Form.Field name="name" label="Tên vụ" hint="Không ghi năm, ví dụ: Đông Xuân, ĐBSCL">
          <Form.Input maxLength={100} autoComplete="off" />
        </Form.Field>
        <Form.Field
          name="regionId"
          label="Vùng"
          hint="Lọc vùng trên Dashboard, Báo cáo thì chỉ chọn được vụ của vùng đó và vụ cho mọi vùng"
        >
          <Form.Select
            options={regions.map((region) => ({ value: region.id, label: region.name }))}
            emptyLabel="Mọi vùng"
          />
        </Form.Field>
        <Form.Field name="start" label="Từ ngày (dd/mm)" hint="Ví dụ 05/11">
          <Form.Input inputMode="numeric" maxLength={5} autoComplete="off" />
        </Form.Field>
        <Form.Field
          name="end"
          label="Đến ngày (dd/mm)"
          hint="Trước ngày bắt đầu trong năm là sang năm sau, ví dụ 15/03"
        >
          <Form.Input inputMode="numeric" maxLength={5} autoComplete="off" />
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

type TableProps = { rows: SeasonRow[]; regions: RegionOption[]; canManage: boolean };

export function SeasonsTable({ rows, regions, canManage }: TableProps) {
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
      {editing?.kind === 'create' ? (
        <SeasonSheet row={null} regions={regions} onClose={close} />
      ) : null}
      {editing?.kind === 'edit' ? (
        <SeasonSheet row={editing.row} regions={regions} onClose={close} />
      ) : null}
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
