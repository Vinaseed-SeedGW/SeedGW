'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { formatKm } from '@seedgw/contracts/check-ins';
import { DEALER_LEVEL_LABEL } from '@seedgw/contracts/dealers';
import { formatDate, formatNumber } from '@seedgw/contracts/format';
import {
  ratioPercent,
  type DealerReportRow,
  type ReportResult,
  type ReportTarget,
  type StaffReportRow,
  type UnitReportRow,
} from '@seedgw/contracts/reports';
import { DataTable, type ColumnDef } from '@seedgw/ui/data-table';
import { downloadFile } from '@seedgw/ui/download-file';
import { useToast } from '@seedgw/ui/toast';
import { exportReportAction } from '@/server/actions/reports';

const SECONDARY = 'max-md:hidden';
const NUMBER = 'text-right tabular-nums';

function percent(part: number, whole: number | null | undefined): string {
  const value = whole ? ratioPercent(part, whole) : null;
  return value === null ? '' : `${String(value).replace('.', ',')}%`;
}

function progress(actual: number, target: number | undefined): string {
  if (!target) return formatNumber(actual);
  return `${formatNumber(actual)} / ${formatNumber(target)}, ${percent(actual, target)}`;
}

function targetColumns<
  T extends { visits: number; dealersVisited: number; target: ReportTarget | null },
>(withTarget: boolean): ColumnDef<T>[] {
  return [
    {
      id: 'visits',
      header: withTarget ? 'Lượt ghé thăm / chỉ tiêu' : 'Lượt ghé thăm',
      meta: { label: 'Lượt ghé thăm', className: NUMBER },
      cell: ({ row }) => progress(row.original.visits, row.original.target?.visitCountTarget),
    },
    {
      id: 'dealers',
      header: withTarget ? 'Đại lý được ghé / chỉ tiêu' : 'Đại lý được ghé',
      meta: { label: 'Đại lý được ghé', className: NUMBER },
      cell: ({ row }) =>
        progress(row.original.dealersVisited, row.original.target?.dealerCoverageTarget),
    },
  ];
}

function staffColumns(withTarget: boolean): ColumnDef<StaffReportRow>[] {
  return [
    {
      accessorKey: 'name',
      header: 'Nhân viên',
      meta: { label: 'Nhân viên', className: 'min-w-44 whitespace-normal!' },
      cell: ({ row }) => (
        <>
          <span className="font-bold">{row.original.name}</span>
          <span className="block text-sm text-text-muted">
            {row.original.code}
            {row.original.orgUnitName ? `, ${row.original.orgUnitName}` : ''}
          </span>
        </>
      ),
    },
    ...targetColumns<StaffReportRow>(withTarget),
    {
      id: 'assigned',
      header: 'Độ phủ đại lý phụ trách',
      meta: { label: 'Độ phủ đại lý phụ trách', className: `${NUMBER} ${SECONDARY}` },
      cell: ({ row }) =>
        row.original.assignedDealers > 0
          ? `${formatNumber(row.original.assignedVisited)} / ${formatNumber(row.original.assignedDealers)}, ${percent(row.original.assignedVisited, row.original.assignedDealers)}`
          : 'Chưa giao đại lý',
    },
    {
      id: 'km',
      header: 'Km',
      meta: { label: 'Km', className: `${NUMBER} ${SECONDARY}` },
      cell: ({ row }) => formatKm(row.original.km),
    },
    {
      id: 'route',
      header: 'Tuyến',
      meta: { label: 'Tuyến', className: `${NUMBER} ${SECONDARY}` },
      cell: ({ row }) =>
        row.original.routePlanned > 0
          ? `${formatNumber(row.original.routeVisited)} / ${formatNumber(row.original.routePlanned)} điểm`
          : 'Chưa có',
    },
  ];
}

function unitColumns(withTarget: boolean): ColumnDef<UnitReportRow>[] {
  return [
    {
      accessorKey: 'name',
      header: 'Đơn vị',
      meta: { label: 'Đơn vị', className: 'min-w-48 whitespace-normal!' },
      cell: ({ row }) => (
        <>
          <span className="font-bold">{row.original.name}</span>
          <span className="block text-sm text-text-muted">{row.original.code}</span>
        </>
      ),
    },
    ...targetColumns<UnitReportRow>(withTarget),
    {
      id: 'coverage',
      header: 'Độ phủ',
      meta: { label: 'Độ phủ', className: `${NUMBER} ${SECONDARY}` },
      cell: ({ row }) =>
        `${percent(row.original.dealersVisited, row.original.activeDealers) || '0%'} của ${formatNumber(row.original.activeDealers)} đại lý`,
    },
    {
      id: 'km',
      header: 'Km',
      meta: { label: 'Km', className: `${NUMBER} ${SECONDARY}` },
      cell: ({ row }) => formatKm(row.original.km),
    },
  ];
}

const DEALER_COLUMNS: ColumnDef<DealerReportRow>[] = [
  {
    accessorKey: 'name',
    header: 'Đại lý',
    meta: { label: 'Đại lý', className: 'min-w-48 whitespace-normal!' },
    cell: ({ row }) => (
      <>
        <Link href={`/kinh-doanh/dai-ly/${row.original.id}`} className="font-bold text-brand">
          {row.original.name}
        </Link>
        <span className="block text-sm text-text-muted">
          {[row.original.code, DEALER_LEVEL_LABEL[row.original.level]].filter(Boolean).join(', ')}
        </span>
      </>
    ),
  },
  {
    id: 'owner',
    header: 'Phụ trách',
    meta: { label: 'Phụ trách', className: `${SECONDARY} whitespace-normal!` },
    cell: ({ row }) => (
      <>
        {row.original.assignedUserName ?? <span className="text-text-muted">Chưa gán</span>}
        {row.original.orgUnitName ? (
          <span className="block text-sm text-text-muted">{row.original.orgUnitName}</span>
        ) : null}
      </>
    ),
  },
  {
    accessorKey: 'visits',
    header: 'Lượt ghé thăm',
    meta: { label: 'Lượt ghé thăm', className: NUMBER },
    cell: ({ row }) => formatNumber(row.original.visits),
  },
  {
    id: 'last',
    header: 'Lần ghé gần nhất trong kỳ',
    meta: { label: 'Lần ghé gần nhất', className: SECONDARY },
    cell: ({ row }) =>
      row.original.lastVisitedAt ? formatDate(row.original.lastVisitedAt) : 'Chưa ghé',
  },
];

function staffId(row: StaffReportRow) {
  return row.code;
}
function unitId(row: UnitReportRow) {
  return row.id;
}
function dealerId(row: DealerReportRow) {
  return row.id;
}

export function ExportReportButton() {
  const searchParams = useSearchParams();
  const { actions: toast } = useToast();
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await exportReportAction(Object.fromEntries(searchParams.entries()));
          if (result.ok) downloadFile(result.data);
          else toast.show({ tone: 'error', message: result.message });
        })
      }
      className="inline-flex h-9.5 items-center rounded-md border border-brand bg-surface px-3 font-bold text-brand hover:bg-brand-soft"
    >
      {isPending ? 'Đang xuất' : 'Xuất Excel'}
    </button>
  );
}

export function ReportTable({ result }: { result: ReportResult }) {
  if (result.group === 'dai-ly') {
    return (
      <DataTable.Root
        columns={DEALER_COLUMNS}
        data={result.rows}
        getRowId={dealerId}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
      >
        <DataTable.Body emptyMessage="Không có đại lý nào trong phạm vi và bộ lọc." />
        <DataTable.Pagination itemLabel="đại lý" />
      </DataTable.Root>
    );
  }
  const withTarget = result.targetMonths !== null;
  if (result.group === 'don-vi') {
    return (
      <DataTable.Root
        columns={unitColumns(withTarget)}
        data={result.rows}
        getRowId={unitId}
        total={result.rows.length}
        page={1}
        pageSize={Math.max(result.rows.length, 1)}
      >
        <DataTable.Body emptyMessage="Không có đơn vị nào trong phạm vi." />
      </DataTable.Root>
    );
  }
  return (
    <DataTable.Root
      columns={staffColumns(withTarget)}
      data={result.rows}
      getRowId={staffId}
      total={result.rows.length}
      page={1}
      pageSize={Math.max(result.rows.length, 1)}
    >
      <DataTable.Body emptyMessage="Không có nhân viên nào trong phạm vi và bộ lọc." />
    </DataTable.Root>
  );
}
