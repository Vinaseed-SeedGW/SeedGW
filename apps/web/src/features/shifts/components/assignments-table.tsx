'use client';

import dynamic from 'next/dynamic';
import { useMemo, useState, type ReactNode } from 'react';
import { formatDateOnly } from '@dms/contracts/format';
import {
  ASSIGNMENT_STATUS_LABEL,
  ASSIGNMENT_TARGET_LABEL,
  type AssignmentRow,
  type AssignmentStatus,
  type ListAssignmentsResult,
  type ShiftFormOptions,
} from '@dms/contracts/shifts';
import { cn } from '@dms/ui/cn';
import { ConfirmDialog } from '@dms/ui/confirm-dialog';
import { DataTable, type ColumnDef } from '@dms/ui/data-table';
import { deleteAssignmentAction } from '@/server/actions/shifts';

const AssignmentSheet = dynamic(
  () => import('@/features/shifts/components/assignment-sheet').then((m) => m.AssignmentSheet),
  { ssr: false },
);

const STATUS_CLASS: Record<AssignmentStatus, string> = {
  UPCOMING: 'bg-warning-soft text-text',
  ACTIVE: 'bg-brand-soft text-brand',
  REPLACED: 'bg-surface-subtle text-text-muted',
};

const WIDE_ONLY = 'max-md:hidden';

function StatusBadge({ status }: { status: AssignmentStatus }) {
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-xs font-bold', STATUS_CLASS[status])}>
      {ASSIGNMENT_STATUS_LABEL[status]}
    </span>
  );
}

function shiftText(row: AssignmentRow): string {
  return row.shiftLabel ?? 'Theo đơn vị cấp trên';
}

const BASE_COLUMNS: ColumnDef<AssignmentRow>[] = [
  {
    id: 'targetLabel',
    header: 'Áp dụng cho',
    meta: { label: 'Áp dụng cho', className: 'whitespace-normal!' },
    cell: ({ row }) => (
      <>
        <span className="text-sm text-text-muted">
          {ASSIGNMENT_TARGET_LABEL[row.original.target]}
        </span>
        <b className="block">{row.original.targetLabel}</b>
        <span className="block text-sm md:hidden">
          {shiftText(row.original)}, từ {formatDateOnly(row.original.effectiveFrom)}
        </span>
        <span className="mt-1 block md:hidden">
          <StatusBadge status={row.original.status} />
        </span>
      </>
    ),
  },
  {
    id: 'shift',
    header: 'Ca',
    meta: { label: 'Ca', className: WIDE_ONLY },
    cell: ({ row }) => shiftText(row.original),
  },
  {
    accessorKey: 'effectiveFrom',
    header: 'Áp dụng từ',
    meta: { label: 'Áp dụng từ', className: WIDE_ONLY },
    cell: ({ row }) => formatDateOnly(row.original.effectiveFrom),
  },
  {
    accessorKey: 'status',
    header: 'Trạng thái',
    meta: { label: 'Trạng thái', className: WIDE_ONLY },
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
];

function getRowId(row: AssignmentRow) {
  return row.id;
}

type ShellProps = {
  data: ListAssignmentsResult;
  columns: ColumnDef<AssignmentRow>[];
  toolbar?: ReactNode;
};

function AssignmentsShell({ data, columns, toolbar }: ShellProps) {
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
      <DataTable.Body emptyMessage="Chưa gán ca cho đơn vị hoặc nhân viên nào." />
      <DataTable.Pagination itemLabel="lần gán" />
    </DataTable.Root>
  );
}

export function AssignmentsTableReadOnly({ data }: { data: ListAssignmentsResult }) {
  return <AssignmentsShell data={data} columns={BASE_COLUMNS} />;
}

type ManagedProps = { data: ListAssignmentsResult; options: ShiftFormOptions };

export function AssignmentsTableManaged({ data, options }: ManagedProps) {
  const [isCreating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<AssignmentRow | null>(null);

  const columns = useMemo<ColumnDef<AssignmentRow>[]>(
    () => [
      ...BASE_COLUMNS,
      {
        id: 'actions',
        header: '',
        enableHiding: false,
        // Chi xoa duoc lan gan chua toi ngay, lan gan da co hieu luc la can cu tinh cong.
        cell: ({ row }) =>
          row.original.status === 'UPCOMING' ? (
            <button
              type="button"
              className="min-h-11 text-sm text-brand md:min-h-0"
              aria-label={`Xoá lần gán ca cho ${row.original.targetLabel}`}
              onClick={() => setDeleting(row.original)}
            >
              Xoá
            </button>
          ) : null,
      },
    ],
    [],
  );

  const hasShifts = options.shifts.length > 0;

  return (
    <>
      <AssignmentsShell
        data={data}
        columns={columns}
        toolbar={
          <>
            <button
              type="button"
              disabled={!hasShifts}
              className="h-9 rounded-md bg-brand px-4 font-bold text-primary-foreground hover:bg-brand-hover disabled:opacity-60"
              onClick={() => setCreating(true)}
            >
              Gán ca
            </button>
            {hasShifts ? null : (
              <span className="text-sm text-text-muted">Cần tạo ca trước khi gán.</span>
            )}
          </>
        }
      />
      {isCreating ? <AssignmentSheet options={options} onClose={() => setCreating(false)} /> : null}
      {deleting ? (
        <ConfirmDialog
          title="Xoá lần gán ca"
          confirmLabel="Xoá"
          tone="danger"
          successMessage="Đã xoá lần gán ca"
          onConfirm={() => deleteAssignmentAction({ target: deleting.target, id: deleting.id })}
          onClose={() => setDeleting(null)}
        >
          Xoá lần gán <b>{shiftText(deleting)}</b> cho <b>{deleting.targetLabel}</b> từ ngày{' '}
          {formatDateOnly(deleting.effectiveFrom)}?
        </ConfirmDialog>
      ) : null}
    </>
  );
}
