'use client';

import dynamic from 'next/dynamic';
import { useMemo, useState, type ReactNode } from 'react';
import {
  formatBreak,
  formatShiftHours,
  formatWeekdays,
  formatWorkUnits,
  type ListShiftsResult,
  type ShiftRow,
} from '@dms/contracts/shifts';
import { ConfirmDialog } from '@dms/ui/confirm-dialog';
import { DataTable, type ColumnDef } from '@dms/ui/data-table';
import { deleteShiftAction } from '@/server/actions/shifts';

// Form va Zod chi tai khi can tao hoac sua ca.
const ShiftSheetCreate = dynamic(
  () => import('@/features/shifts/components/shift-sheet').then((m) => m.ShiftSheetCreate),
  { ssr: false },
);
const ShiftSheetEdit = dynamic(
  () => import('@/features/shifts/components/shift-sheet').then((m) => m.ShiftSheetEdit),
  { ssr: false },
);

// Bang co 8 cot, duoi 1280 px gop vao dong tom tat de khong phai vuot ngang.
const WIDE_ONLY = 'max-xl:hidden';

function graceText(row: ShiftRow): string {
  return `Muộn ${row.lateGraceMinutes} phút, sớm ${row.earlyGraceMinutes} phút`;
}

const BASE_COLUMNS: ColumnDef<ShiftRow>[] = [
  {
    accessorKey: 'code',
    header: 'Mã',
    meta: { label: 'Mã' },
    cell: ({ row }) => <b className="text-brand">{row.original.code}</b>,
  },
  {
    accessorKey: 'name',
    header: 'Tên ca',
    meta: { label: 'Tên ca', className: 'whitespace-normal!' },
    cell: ({ row }) => (
      <>
        {row.original.name}
        {/* Man hinh hep gop cac cot con lai vao duoi ten. */}
        <span className="block text-sm text-text-muted xl:hidden">
          {formatShiftHours(row.original)}, {formatWorkUnits(row.original.workUnits)},{' '}
          {formatWeekdays(row.original.workWeekdays)}
        </span>
        <span className="block text-sm text-text-muted xl:hidden">
          Nghỉ giữa ca: {formatBreak(row.original)}. {graceText(row.original)}.
        </span>
      </>
    ),
  },
  {
    id: 'hours',
    header: 'Giờ làm',
    meta: { label: 'Giờ làm', className: WIDE_ONLY },
    cell: ({ row }) => formatShiftHours(row.original),
  },
  {
    id: 'break',
    header: 'Nghỉ giữa ca',
    meta: { label: 'Nghỉ giữa ca', className: WIDE_ONLY },
    cell: ({ row }) => formatBreak(row.original),
  },
  {
    id: 'grace',
    header: 'Cho phép',
    meta: { label: 'Cho phép', className: WIDE_ONLY },
    cell: ({ row }) => graceText(row.original),
  },
  {
    accessorKey: 'workUnits',
    header: 'Số công',
    meta: { label: 'Số công', className: WIDE_ONLY },
    cell: ({ row }) => formatWorkUnits(row.original.workUnits),
  },
  {
    id: 'weekdays',
    header: 'Ngày làm',
    meta: { label: 'Ngày làm', className: WIDE_ONLY },
    cell: ({ row }) => formatWeekdays(row.original.workWeekdays),
  },
  {
    accessorKey: 'assignmentCount',
    header: 'Số lần gán',
    meta: { label: 'Số lần gán', className: WIDE_ONLY },
  },
];

function getRowId(row: ShiftRow) {
  return row.id;
}

type ShellProps = { data: ListShiftsResult; columns: ColumnDef<ShiftRow>[]; toolbar?: ReactNode };

function ShiftsShell({ data, columns, toolbar }: ShellProps) {
  return (
    <DataTable.Root
      columns={columns}
      data={data.items}
      getRowId={getRowId}
      total={data.total}
      page={data.page}
      pageSize={data.pageSize}
    >
      {toolbar ? <DataTable.Toolbar>{toolbar}</DataTable.Toolbar> : null}
      <DataTable.Body emptyMessage="Chưa có ca làm việc nào." />
      <DataTable.Pagination itemLabel="ca" />
    </DataTable.Root>
  );
}

export function ShiftsTableReadOnly({ data }: { data: ListShiftsResult }) {
  return <ShiftsShell data={data} columns={BASE_COLUMNS} />;
}

const ROW_BUTTON_CLASS = 'min-h-11 text-sm text-brand md:min-h-0';

export function ShiftsTableManaged({ data }: { data: ListShiftsResult }) {
  const [isCreating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ShiftRow | null>(null);
  const [deleting, setDeleting] = useState<ShiftRow | null>(null);

  const columns = useMemo<ColumnDef<ShiftRow>[]>(
    () => [
      ...BASE_COLUMNS,
      {
        id: 'actions',
        header: '',
        enableHiding: false,
        cell: ({ row }) => (
          <span className="flex gap-3">
            <button
              type="button"
              className={ROW_BUTTON_CLASS}
              aria-label={`Sửa ca ${row.original.code}`}
              onClick={() => setEditing(row.original)}
            >
              Sửa
            </button>
            {row.original.assignmentCount === 0 ? (
              <button
                type="button"
                className={ROW_BUTTON_CLASS}
                aria-label={`Xoá ca ${row.original.code}`}
                onClick={() => setDeleting(row.original)}
              >
                Xoá
              </button>
            ) : null}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <>
      <ShiftsShell
        data={data}
        columns={columns}
        toolbar={
          <button
            type="button"
            className="h-9 rounded-md bg-brand px-4 font-bold text-primary-foreground hover:bg-brand-hover"
            onClick={() => setCreating(true)}
          >
            Tạo ca
          </button>
        }
      />
      {isCreating ? <ShiftSheetCreate onClose={() => setCreating(false)} /> : null}
      {editing ? <ShiftSheetEdit shift={editing} onClose={() => setEditing(null)} /> : null}
      {deleting ? (
        <ConfirmDialog
          title="Xoá ca làm việc"
          confirmLabel="Xoá"
          tone="danger"
          successMessage="Đã xoá ca"
          onConfirm={() => deleteShiftAction({ id: deleting.id })}
          onClose={() => setDeleting(null)}
        >
          Xoá ca <b>{deleting.code}</b> - {deleting.name}? Ca chưa được gán cho ai nên xoá không ảnh
          hưởng ngày công.
        </ConfirmDialog>
      ) : null}
    </>
  );
}
