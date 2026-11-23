'use client';

import { formatNumber } from '@seedgw/contracts/format';
import {
  targetPercent,
  type ListSalesTargetsResult,
  type SalesTargetRow,
} from '@seedgw/contracts/sales-targets';
import { FEATURES } from '@seedgw/contracts/features';
import { DataTable, type ColumnDef } from '@seedgw/ui/data-table';
import { ApprovalStatusBadge } from '@/features/approvals/components/approval-status-badge';
import { TargetOnBehalfCreateButton, TargetOnBehalfEditButton } from './target-form-sheet';

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
  ...(FEATURES.sales
    ? [
        {
          id: 'sales',
          header: 'Thực bán (kg)',
          meta: { label: 'Thực bán (kg)', className: SECONDARY_COLUMN },
          cell: ({ row }: { row: { original: SalesTargetRow } }) =>
            row.original.approved ? formatNumber(row.original.approved.salesKgTarget) : 'Chưa có',
        },
      ]
    : []),
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

type Option = { value: string; label: string };
/** Có khi người xem là Quản trị hệ thống: đăng ký thay, sửa thay. */
type OverrideTools = { employees: readonly Option[]; editableMonths: readonly Option[] };

function overrideColumn(tools: OverrideTools): ColumnDef<SalesTargetRow> {
  const editable = new Set(tools.editableMonths.map((item) => item.value));
  return {
    id: 'override',
    header: 'Làm thay',
    meta: { label: 'Làm thay' },
    cell: ({ row }) => {
      const status = row.original.approvalStatus;
      if (!editable.has(row.original.month)) return null;
      if (status === 'PENDING_MANAGER' || status === 'PENDING_LEADER') {
        return <span className="text-sm text-text-muted">Rút lại ở Cần duyệt để sửa</span>;
      }
      return (
        <TargetOnBehalfEditButton
          forUserId={row.original.userId}
          userLabel={`${row.original.userName} (${row.original.userCode})`}
          month={row.original.month}
          current={row.original.proposed}
        />
      );
    },
  };
}

function getId(row: SalesTargetRow) {
  return row.id;
}

/** Chỉ tiêu của nhân viên trong phạm vi; thực tế so với bản đang hiệu lực. */
export function ScopeTargetsTable({
  data,
  months,
  override,
}: {
  data: ListSalesTargetsResult;
  months: ReadonlyArray<{ value: string; label: string }>;
  override: OverrideTools | null;
}) {
  return (
    <DataTable.Root
      columns={override ? [...COLUMNS, overrideColumn(override)] : COLUMNS}
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
        {override ? (
          <TargetOnBehalfCreateButton
            employees={override.employees}
            months={override.editableMonths}
          />
        ) : null}
      </DataTable.Toolbar>
      <DataTable.Body emptyMessage="Chưa có nhân viên nào đăng ký chỉ tiêu tháng này." />
      <DataTable.Pagination itemLabel="nhân viên" />
    </DataTable.Root>
  );
}
