'use client';

import dynamic from 'next/dynamic';
import { useMemo, useState, type ReactNode } from 'react';
import { formatDateOnly } from '@dms/contracts/format';
import {
  DELEGATION_STATUS_LABEL,
  type DelegationRow,
  type DelegationStatus,
  type ListDelegationsResult,
  type SelectOption,
} from '@dms/contracts/workflows';
import { cn } from '@dms/ui/cn';
import { ConfirmDialog } from '@dms/ui/confirm-dialog';
import { DataTable, type ColumnDef } from '@dms/ui/data-table';
import { revokeDelegationAction } from '@/server/actions/workflows';

// Form va Zod chi tai khi can tao uy quyen.
const DelegationSheet = dynamic(
  () => import('@/features/workflows/components/delegation-sheet').then((m) => m.DelegationSheet),
  { ssr: false },
);

const STATUS_CLASS: Record<DelegationStatus, string> = {
  SCHEDULED: 'bg-warning-soft text-warning',
  ACTIVE: 'bg-brand-soft text-brand',
  EXPIRED: 'bg-surface-subtle text-text-muted',
  REVOKED: 'bg-danger-soft text-danger',
};

const BASE_COLUMNS: ColumnDef<DelegationRow>[] = [
  { accessorKey: 'delegatorName', header: 'Người vắng', meta: { label: 'Người vắng' } },
  { accessorKey: 'delegateName', header: 'Người nhận', meta: { label: 'Người nhận' } },
  {
    accessorKey: 'startDate',
    header: 'Từ ngày',
    cell: ({ row }) => formatDateOnly(row.original.startDate),
    meta: { label: 'Từ ngày' },
  },
  {
    accessorKey: 'endDate',
    header: 'Đến ngày',
    cell: ({ row }) => formatDateOnly(row.original.endDate),
    meta: { label: 'Đến ngày' },
  },
  {
    accessorKey: 'reason',
    header: 'Lý do',
    meta: { label: 'Lý do', className: 'min-w-48 whitespace-normal! max-md:hidden' },
  },
  {
    accessorKey: 'status',
    header: 'Trạng thái',
    cell: ({ row }) => (
      <span
        className={cn(
          'rounded-full px-2 py-0.5 text-xs font-bold',
          STATUS_CLASS[row.original.status],
        )}
      >
        {DELEGATION_STATUS_LABEL[row.original.status]}
      </span>
    ),
    meta: { label: 'Trạng thái' },
  },
];

function getRowId(row: DelegationRow) {
  return row.id;
}

type ShellProps = {
  data: ListDelegationsResult;
  columns: ColumnDef<DelegationRow>[];
  toolbar?: ReactNode;
};

function DelegationsShell({ data, columns, toolbar }: ShellProps) {
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
      <DataTable.Body emptyMessage="Chưa có uỷ quyền nào." />
      <DataTable.Pagination itemLabel="uỷ quyền" />
    </DataTable.Root>
  );
}

export function DelegationsTableReadOnly({ data }: { data: ListDelegationsResult }) {
  return <DelegationsShell data={data} columns={BASE_COLUMNS} />;
}

function isRevocable(status: DelegationStatus): boolean {
  return status === 'ACTIVE' || status === 'SCHEDULED';
}

type ManagedProps = { data: ListDelegationsResult; userOptions: SelectOption[] };

export function DelegationsTableManaged({ data, userOptions }: ManagedProps) {
  const [isCreating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<DelegationRow | null>(null);

  const columns = useMemo<ColumnDef<DelegationRow>[]>(
    () => [
      ...BASE_COLUMNS,
      {
        id: 'actions',
        header: '',
        enableHiding: false,
        cell: ({ row }) =>
          isRevocable(row.original.status) ? (
            <button
              type="button"
              className="text-sm text-brand"
              onClick={() => setRevoking(row.original)}
            >
              Thu hồi
            </button>
          ) : null,
      },
    ],
    [],
  );

  return (
    <>
      <DelegationsShell
        data={data}
        columns={columns}
        toolbar={
          <button
            type="button"
            className="h-9 rounded-md bg-brand px-4 font-bold text-primary-foreground hover:bg-brand-hover"
            onClick={() => setCreating(true)}
          >
            Tạo uỷ quyền
          </button>
        }
      />
      {isCreating ? (
        <DelegationSheet userOptions={userOptions} onClose={() => setCreating(false)} />
      ) : null}
      {revoking ? (
        <ConfirmDialog
          title="Thu hồi uỷ quyền"
          confirmLabel="Thu hồi"
          tone="danger"
          successMessage="Đã thu hồi uỷ quyền"
          onConfirm={() => revokeDelegationAction({ id: revoking.id })}
          onClose={() => setRevoking(null)}
        >
          Thu hồi uỷ quyền của <b>{revoking.delegatorName}</b> cho <b>{revoking.delegateName}</b>?
          Từ nay người vắng sẽ tự duyệt lại.
        </ConfirmDialog>
      ) : null}
    </>
  );
}
