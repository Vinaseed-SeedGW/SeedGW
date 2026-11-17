'use client';

import { formatNumber } from '@dms/contracts/format';
import {
  targetPercent,
  type ListSalesTargetsResult,
  type SalesTargetRow,
} from '@dms/contracts/sales-targets';
import { DataTable, type ColumnDef } from '@dms/ui/data-table';
import { ApprovalStatusBadge } from '@/features/approvals/components/approval-status-badge';

const SECONDARY_COLUMN = 'max-md:hidden';

function progressText(actual: number, target: number | null): string {
  const percent = targetPercent(actual, target);
  return `${formatNumber(actual)}${target === null ? '' : ` / ${formatNumber(target)}`}${
    percent === null ? '' : `, ${formatNumber(percent)}%`
  }`;
}

const COLUMNS: ColumnDef<SalesTargetRow>[] = [
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
    id: 'visits',
    header: 'Lượt ghé thăm',
    meta: { label: 'Lượt ghé thăm' },
    cell: ({ row }) =>
      progressText(
        row.original.progress.visitCount,
        row.original.approved?.visitCountTarget ?? null,
      ),
  },
  {
    id: 'dealers',
    header: 'Số đại lý được ghé',
    meta: { label: 'Số đại lý được ghé' },
    cell: ({ row }) =>
      progressText(
        row.original.progress.dealerCoverage,
        row.original.approved?.dealerCoverageTarget ?? null,
      ),
  },
  {
    id: 'sales',
    header: 'Thực bán (kg)',
    meta: { label: 'Thực bán (kg)', className: SECONDARY_COLUMN },
    cell: ({ row }) =>
      row.original.approved ? formatNumber(row.original.approved.salesKgTarget) : 'Chưa có',
  },
  {
    accessorKey: 'approvalStatus',
    header: 'Trạng thái',
    meta: { label: 'Trạng thái' },
    cell: ({ row }) =>
      row.original.approvalStatus ? (
        <>
          <ApprovalStatusBadge status={row.original.approvalStatus} />
          {row.original.approvalCode ? (
            <span className="block text-sm text-text-muted">{row.original.approvalCode}</span>
          ) : null}
        </>
      ) : null,
  },
];

function getId(row: SalesTargetRow) {
  return row.id;
}

/** Chỉ tiêu của nhân viên trong phạm vi; thực tế so với bản đang hiệu lực. */
export function ScopeTargetsTable({
  data,
  months,
}: {
  data: ListSalesTargetsResult;
  months: ReadonlyArray<{ value: string; label: string }>;
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
          <DataTable.SelectFilter
            param="thang"
            label="Tháng"
            allLabel="Tháng này"
            options={months}
          />
        </DataTable.Filters>
      </DataTable.Toolbar>
      <DataTable.Body emptyMessage="Chưa có nhân viên nào đăng ký chỉ tiêu tháng này." />
      <DataTable.Pagination itemLabel="nhân viên" />
    </DataTable.Root>
  );
}
