'use client';

import type { AuditLogSummary, ListAuditLogsResult } from '@dms/contracts/audit';
import { formatDateTime } from '@dms/contracts/format';
import { DataTable, type ColumnDef } from '@dms/ui/data-table';

const SECONDARY_COLUMN = 'max-md:hidden';

const COLUMNS: ColumnDef<AuditLogSummary>[] = [
  {
    accessorKey: 'createdAt',
    header: 'Thời gian',
    cell: ({ row }) => formatDateTime(row.original.createdAt),
    meta: { label: 'Thời gian' },
  },
  {
    accessorKey: 'actorName',
    header: 'Người thực hiện',
    cell: ({ row }) => row.original.actorName ?? '(đã xoá)',
    meta: { label: 'Người thực hiện' },
  },
  { accessorKey: 'actionLabel', header: 'Thao tác', meta: { label: 'Thao tác' } },
  { accessorKey: 'entityLabel', header: 'Đối tượng', meta: { label: 'Đối tượng' } },
  {
    id: 'changes',
    header: 'Thay đổi',
    meta: { label: 'Thay đổi', className: 'min-w-64 whitespace-normal!' },
    cell: ({ row }) => (
      <ul>
        {row.original.changes.map((change) => (
          <li key={change.label}>
            <b>{change.label}:</b> {change.before} thành {change.after}
          </li>
        ))}
      </ul>
    ),
  },
  {
    accessorKey: 'ip',
    header: 'Địa chỉ IP',
    cell: ({ row }) => row.original.ip ?? '',
    meta: { label: 'Địa chỉ IP', className: SECONDARY_COLUMN },
  },
];

function getLogId(log: AuditLogSummary) {
  return log.id;
}

export function AuditLogsTable({ data }: { data: ListAuditLogsResult }) {
  return (
    <DataTable.Root
      columns={COLUMNS}
      data={data.items}
      getRowId={getLogId}
      total={data.total}
      page={data.page}
      pageSize={data.pageSize}
    >
      <DataTable.Body emptyMessage="Chưa có thao tác nào được ghi nhận." />
      <DataTable.Pagination itemLabel="dòng nhật ký" />
    </DataTable.Root>
  );
}
