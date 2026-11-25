'use client';

import Link from 'next/link';
import {
  CUSTOMER_KIND_LABEL,
  formatAreaHa,
  type CustomerSummary,
  type ListCustomersResult,
} from '@seedgw/contracts/customers';
import { formatDate } from '@seedgw/contracts/format';
import { DataTable, type ColumnDef } from '@seedgw/ui/data-table';

const SECONDARY_COLUMN = 'max-md:hidden';

const KIND_OPTIONS = [
  { value: 'nong-dan', label: CUSTOMER_KIND_LABEL.FARMER },
  { value: 'hop-tac-xa', label: CUSTOMER_KIND_LABEL.COOPERATIVE },
];

type Option = { value: string; label: string };

function muted(text: string) {
  return <span className="text-text-muted">{text}</span>;
}

function columns(basePath: string): ColumnDef<CustomerSummary>[] {
  return [
    {
      id: 'code',
      header: 'Mã',
      meta: { label: 'Mã', sortKey: 'code' },
      cell: ({ row }) => (
        <Link href={`${basePath}/${row.original.id}`} className="font-bold text-brand">
          {row.original.code}
        </Link>
      ),
    },
    {
      accessorKey: 'name',
      header: 'Khách hàng',
      meta: { label: 'Khách hàng', sortKey: 'name', className: 'min-w-56 whitespace-normal!' },
      cell: ({ row }) => (
        <>
          <Link href={`${basePath}/${row.original.id}`} className="hover:underline">
            {row.original.name}
          </Link>
          <span className="block text-sm text-text-muted">
            {CUSTOMER_KIND_LABEL[row.original.kind]}
            {row.original.phone ? `, ${row.original.phone}` : ''}
          </span>
        </>
      ),
    },
    {
      id: 'province',
      header: 'Tỉnh',
      meta: { label: 'Tỉnh', className: SECONDARY_COLUMN },
      cell: ({ row }) => row.original.provinceName ?? muted('Chưa có'),
    },
    {
      id: 'crops',
      header: 'Cây trồng, diện tích',
      meta: { label: 'Cây trồng, diện tích', className: 'whitespace-normal!' },
      cell: ({ row }) => (
        <>
          {row.original.crops.length > 0 ? row.original.crops.join(', ') : muted('Chưa có')}
          {row.original.areaHa !== null ? (
            <span className="block text-sm text-text-muted tabular-nums">
              {formatAreaHa(row.original.areaHa)}
            </span>
          ) : null}
        </>
      ),
    },
    {
      id: 'dealers',
      header: 'Đại lý hay mua',
      meta: { label: 'Đại lý hay mua', className: `${SECONDARY_COLUMN} whitespace-normal!` },
      cell: ({ row }) =>
        row.original.dealerNames.length > 0
          ? row.original.dealerNames.join(', ')
          : muted('Chưa có'),
    },
    {
      id: 'assignee',
      header: 'Phụ trách',
      meta: { label: 'Phụ trách', className: SECONDARY_COLUMN },
      cell: ({ row }) => row.original.assignedUserName ?? muted('Chưa gán'),
    },
    {
      id: 'lastVisitedAt',
      header: 'Lần ghé gần nhất',
      meta: { label: 'Lần ghé gần nhất', sortKey: '-lastVisitedAt' },
      cell: ({ row }) =>
        row.original.lastVisitedAt ? (
          <span className="tabular-nums">{formatDate(row.original.lastVisitedAt)}</span>
        ) : (
          muted('Chưa ghé')
        ),
    },
  ];
}

function getCustomerId(customer: CustomerSummary) {
  return customer.id;
}

type Props = {
  data: ListCustomersResult;
  basePath: string;
  provinceOptions: Option[];
  cropOptions: Option[];
};

export function CustomersTable({ data, basePath, provinceOptions, cropOptions }: Props) {
  return (
    <DataTable.Root
      columns={columns(basePath)}
      data={data.items}
      getRowId={getCustomerId}
      total={data.total}
      page={data.page}
      pageSize={data.pageSize}
    >
      <DataTable.Toolbar>
        <DataTable.Search placeholder="Tìm mã, tên, số điện thoại" />
        <DataTable.Filters>
          <DataTable.SelectFilter
            param="loai"
            label="Lọc theo loại khách hàng"
            allLabel="Nông dân và HTX"
            options={KIND_OPTIONS}
          />
          <DataTable.SelectFilter
            param="tinh"
            label="Lọc theo tỉnh"
            allLabel="Tất cả tỉnh"
            options={provinceOptions}
          />
          {cropOptions.length > 0 ? (
            <DataTable.SelectFilter
              param="cay"
              label="Lọc theo cây trồng"
              allLabel="Mọi cây trồng"
              options={cropOptions}
            />
          ) : null}
        </DataTable.Filters>
        <DataTable.Columns />
      </DataTable.Toolbar>
      <DataTable.Body emptyMessage="Chưa có khách hàng nào khớp bộ lọc." />
      <DataTable.Pagination itemLabel="khách hàng" />
    </DataTable.Root>
  );
}
