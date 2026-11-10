'use client';

import {
  AUDIT_ENTITY_OPTIONS,
  type AuditLogSummary,
  type ListAuditLogsResult,
} from '@dms/contracts/audit';
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
    cell: ({ row }) => (
      <>
        {row.original.actorName ?? '(đã xoá)'}
        {row.original.impersonatorName ? (
          <span className="block text-sm text-text-muted">
            Do {row.original.impersonatorName} đăng nhập thay
          </span>
        ) : null}
      </>
    ),
    meta: { label: 'Người thực hiện' },
  },
  { accessorKey: 'actionLabel', header: 'Thao tác', meta: { label: 'Thao tác' } },
  {
    accessorKey: 'entityLabel',
    header: 'Đối tượng',
    cell: ({ row }) => (
      <>
        {row.original.entityLabel}
        <span className="block text-sm text-text-muted">{row.original.entityTypeLabel}</span>
      </>
    ),
    meta: { label: 'Đối tượng' },
  },
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
      <DataTable.Toolbar>
        <DataTable.Search placeholder="Tìm người thực hiện" />
        <DataTable.Filters>
          <DataTable.SelectFilter
            param="doi-tuong"
            label="Lọc theo đối tượng"
            allLabel="Tất cả đối tượng"
            options={AUDIT_ENTITY_OPTIONS}
          />
          <DataTable.DateFilter param="tu-ngay" label="Từ ngày" />
          <DataTable.DateFilter param="den-ngay" label="Đến ngày" />
        </DataTable.Filters>
      </DataTable.Toolbar>
      <DataTable.Body emptyMessage="Không có dòng nhật ký nào phù hợp." />
      <DataTable.Pagination itemLabel="dòng nhật ký" />
    </DataTable.Root>
  );
}
