'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  DEALER_ASSIGNEE_UNASSIGNED,
  DEALER_LEVEL_LABEL,
  DEALER_LEVELS,
  DEALER_STATUS_LABEL,
  type DealerFilter,
  type DealerFormOptions,
  type DealerOption,
  type DealerSummary,
  type ListDealersResult,
} from '@dms/contracts/dealers';
import { formatDate, formatNumber } from '@dms/contracts/format';
import { DataTable, selectionColumn, useDataTable, type ColumnDef } from '@dms/ui/data-table';
import { exportDealersAction } from '@/server/actions/dealers';
import { DealerBulkDialog, type BulkMode } from './dealer-bulk-dialog';

const SECONDARY_COLUMN = 'max-md:hidden';

const LEVEL_OPTIONS = DEALER_LEVELS.map((level) => ({
  value: String(level),
  label: DEALER_LEVEL_LABEL[level],
}));
const STATUS_OPTIONS = [
  { value: 'dang-hoat-dong', label: DEALER_STATUS_LABEL.ACTIVE },
  { value: 'ngung-hoat-dong', label: DEALER_STATUS_LABEL.INACTIVE },
];
const ASSIGNEE_OPTIONS = [{ value: DEALER_ASSIGNEE_UNASSIGNED, label: 'Chưa gán nhân viên' }];
const LOCATION_OPTIONS = [{ value: 'chua-co', label: 'Chưa có toạ độ' }];

// Mốc quá hạn theo cấp đại lý đặt ở Tham số (K0).
const VISIT_OPTIONS = [
  { value: 'qua-moc', label: 'Quá mốc chưa ghé lại' },
  { value: 'chua-ghe', label: 'Chưa ghé lần nào' },
];

function columns(basePath: string): ColumnDef<DealerSummary>[] {
  return [
    selectionColumn<DealerSummary>(),
    {
      id: 'code',
      header: 'Mã đại lý',
      meta: { label: 'Mã đại lý', sortKey: 'code' },
      cell: ({ row }) => (
        <Link href={`${basePath}/${row.original.id}`} className="text-brand">
          {row.original.code ?? 'Chưa có mã FAST'}
          {row.original.legacyCode ? (
            <span className="block text-sm text-text-muted">{row.original.legacyCode}</span>
          ) : null}
        </Link>
      ),
    },
    {
      accessorKey: 'name',
      header: 'Tên đại lý',
      meta: { label: 'Tên đại lý', sortKey: 'name', className: 'min-w-56 whitespace-normal!' },
      cell: ({ row }) => (
        <>
          {row.original.name}
          <span className="block text-sm text-text-muted">
            {DEALER_LEVEL_LABEL[row.original.level]}
            {row.original.status === 'INACTIVE' ? `, ${DEALER_STATUS_LABEL.INACTIVE}` : ''}
          </span>
        </>
      ),
    },
    {
      id: 'phone',
      header: 'Điện thoại',
      meta: { label: 'Điện thoại', className: SECONDARY_COLUMN },
      cell: ({ row }) => row.original.phone ?? <span className="text-text-muted">Chưa có</span>,
    },
    {
      id: 'province',
      header: 'Tỉnh, thành phố',
      meta: { label: 'Tỉnh, thành phố', className: SECONDARY_COLUMN },
      cell: ({ row }) => row.original.provinceName ?? '',
    },
    {
      id: 'orgUnit',
      header: 'Đơn vị phụ trách',
      meta: { label: 'Đơn vị phụ trách', className: `${SECONDARY_COLUMN} whitespace-normal!` },
      cell: ({ row }) => row.original.orgUnitName ?? '',
    },
    {
      id: 'assignee',
      header: 'Nhân viên phụ trách',
      meta: { label: 'Nhân viên phụ trách', className: 'whitespace-normal!' },
      cell: ({ row }) =>
        row.original.assignedUserName ?? (
          <span className="text-text-muted">
            Chờ gán
            {row.original.legacyAssigneeName ? ` (DMS cũ: ${row.original.legacyAssigneeName})` : ''}
          </span>
        ),
    },
    {
      id: 'location',
      header: 'Toạ độ',
      meta: { label: 'Toạ độ', className: SECONDARY_COLUMN },
      cell: ({ row }) =>
        row.original.hasLocation ? 'Đã có' : <span className="text-text-muted">Chưa có</span>,
    },
    {
      id: 'lastVisitedAt',
      header: 'Lần ghé gần nhất',
      meta: { label: 'Lần ghé gần nhất', className: SECONDARY_COLUMN },
      cell: ({ row }) =>
        row.original.lastVisitedAt ? (
          formatDate(row.original.lastVisitedAt)
        ) : (
          <span className="text-text-muted">Chưa ghé</span>
        ),
    },
  ];
}

function getDealerId(dealer: DealerSummary) {
  return dealer.id;
}

type Props = {
  data: ListDealersResult;
  filter: DealerFilter;
  basePath: string;
  orgUnitFilter: DealerOption[];
  editOptions: DealerFormOptions | null;
};

export function DealersTable({ data, filter, basePath, orgUnitFilter, editOptions }: Props) {
  return (
    <DataTable.Root
      columns={columns(basePath)}
      data={data.items}
      getRowId={getDealerId}
      total={data.total}
      page={data.page}
      pageSize={data.pageSize}
    >
      <DataTable.Toolbar>
        <DataTable.Search placeholder="Tìm mã, tên, số điện thoại, mã số thuế" />
        <DataTable.Filters>
          <DataTable.SelectFilter
            param="cap"
            label="Lọc theo cấp"
            allLabel="Tất cả các cấp"
            options={LEVEL_OPTIONS}
          />
          <DataTable.SelectFilter
            param="trang-thai"
            label="Lọc theo trạng thái"
            allLabel="Mọi trạng thái"
            options={STATUS_OPTIONS}
          />
          <DataTable.SelectFilter
            param="don-vi"
            label="Lọc theo đơn vị phụ trách"
            allLabel="Tất cả đơn vị"
            options={orgUnitFilter}
          />
          <DataTable.SelectFilter
            param="nhan-vien"
            label="Lọc theo nhân viên phụ trách"
            allLabel="Đã gán và chưa gán"
            options={ASSIGNEE_OPTIONS}
          />
          <DataTable.SelectFilter
            param="toa-do"
            label="Lọc theo toạ độ"
            allLabel="Có và chưa có toạ độ"
            options={LOCATION_OPTIONS}
          />
          <DataTable.SelectFilter
            param="ghe-tham"
            label="Lọc theo lần ghé thăm"
            allLabel="Mọi lần ghé thăm"
            options={VISIT_OPTIONS}
          />
        </DataTable.Filters>
        <DataTable.Columns />
        <DataTable.Export action={(ids) => exportDealersAction(filter, ids)} />
        {editOptions ? (
          <BulkButtons filter={filter} total={data.total} options={editOptions} />
        ) : null}
      </DataTable.Toolbar>
      <DataTable.Body emptyMessage="Không có đại lý nào khớp bộ lọc." />
      <DataTable.Pagination itemLabel="đại lý" />
    </DataTable.Root>
  );
}

/** Gán nhân viên, đổi đơn vị cho dòng đã chọn, không chọn thì áp cho mọi đại lý khớp bộ lọc. */
function BulkButtons({
  filter,
  total,
  options,
}: {
  filter: DealerFilter;
  total: number;
  options: DealerFormOptions;
}) {
  const { state, actions } = useDataTable();
  const [mode, setMode] = useState<BulkMode | null>(null);
  const selected = state.selectedIds.length;
  const scopeLabel =
    selected > 0
      ? `${formatNumber(selected)} đại lý đã chọn`
      : `tất cả ${formatNumber(total)} đại lý đang lọc`;
  const buttonClass =
    'inline-flex h-9 flex-none items-center rounded-md border border-brand bg-surface px-3 font-bold text-brand hover:bg-brand-soft disabled:opacity-50';

  return (
    <>
      <button
        type="button"
        className={buttonClass}
        disabled={total === 0}
        onClick={() => setMode('ASSIGN')}
      >
        Gán nhân viên
      </button>
      {options.canMoveOrgUnit ? (
        <button
          type="button"
          className={buttonClass}
          disabled={total === 0}
          onClick={() => setMode('MOVE')}
        >
          Đổi đơn vị
        </button>
      ) : null}
      {mode ? (
        <DealerBulkDialog
          mode={mode}
          scopeLabel={scopeLabel}
          target={{ filter, ids: state.selectedIds }}
          options={options}
          onClose={() => setMode(null)}
          onDone={actions.clearSelection}
        />
      ) : null}
    </>
  );
}
