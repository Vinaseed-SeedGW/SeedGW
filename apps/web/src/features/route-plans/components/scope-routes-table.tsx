'use client';

import Link from 'next/link';
import { formatNumber } from '@seedgw/contracts/format';
import {
  ROUTE_KIND_LABEL,
  type ListRoutePlansResult,
  type RoutePlanRow,
} from '@seedgw/contracts/route-plans';
import { DataTable, type ColumnDef } from '@seedgw/ui/data-table';
import { ApprovalStatusBadge } from '@/features/approvals/components/approval-status-badge';

const SECONDARY_COLUMN = 'max-md:hidden';

const COLUMNS: ColumnDef<RoutePlanRow>[] = [
  {
    accessorKey: 'userName',
    header: 'Nhân viên',
    meta: { label: 'Nhân viên' },
    cell: ({ row }) => (
      <>
        {row.original.userName}
        <span className="block text-sm text-text-muted">
          {row.original.userCode}
          {row.original.orgUnitName ? `, ${row.original.orgUnitName}` : ''}
        </span>
      </>
    ),
  },
  {
    accessorKey: 'periodLabel',
    header: 'Kỳ',
    meta: { label: 'Kỳ' },
    cell: ({ row }) => (
      <>
        <Link
          href={`/kinh-doanh/tuyen-vieng-tham/${row.original.id}`}
          className="font-bold text-brand hover:underline"
        >
          {row.original.periodLabel}
        </Link>
        <span className="block text-sm text-text-muted">
          {ROUTE_KIND_LABEL[row.original.kind]}, {formatNumber(row.original.stopCount)} điểm
        </span>
      </>
    ),
  },
  {
    id: 'completion',
    header: 'Hoàn thành',
    meta: { label: 'Hoàn thành', className: SECONDARY_COLUMN },
    cell: ({ row }) => {
      const completion = row.original.completion;
      if (!completion || completion.planned === 0)
        return <span className="text-text-muted">Chưa có</span>;
      return `${formatNumber(completion.visited)} / ${formatNumber(completion.planned)}, ${formatNumber(
        Math.round((completion.visited / completion.planned) * 100),
      )}%`;
    },
  },
  {
    accessorKey: 'approvalStatus',
    header: 'Trạng thái',
    meta: { label: 'Trạng thái' },
    cell: ({ row }) => (
      <>
        {row.original.approvalStatus ? (
          <ApprovalStatusBadge status={row.original.approvalStatus} />
        ) : null}
        {row.original.isLate ? (
          <span className="ml-1 rounded-sm bg-warning-soft px-1.5 text-sm">Nộp muộn</span>
        ) : null}
        {row.original.approvalCode ? (
          <span className="block text-sm text-text-muted">{row.original.approvalCode}</span>
        ) : null}
      </>
    ),
  },
];

function getId(row: RoutePlanRow) {
  return row.id;
}

export function ScopeRoutesTable({
  data,
  weeks,
}: {
  data: ListRoutePlansResult;
  weeks: ReadonlyArray<{ value: string; label: string }>;
}) {
  return (
    <DataTable.Root
      columns={COLUMNS}
      data={data.items}
      getRowId={getId}
      total={data.total}
      page={data.page}
      pageSize={data.pageSize}
    >
      <DataTable.Toolbar>
        <DataTable.Search placeholder="Tìm tên hoặc mã nhân viên" />
        <DataTable.Filters>
          <DataTable.SelectFilter param="tuan" label="Tuần" allLabel="Tuần này" options={weeks} />
        </DataTable.Filters>
      </DataTable.Toolbar>
      <DataTable.Body emptyMessage="Chưa có tuyến nào trong tuần này." />
      <DataTable.Pagination itemLabel="tuyến" />
    </DataTable.Root>
  );
}
