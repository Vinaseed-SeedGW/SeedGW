'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  CONSENT_CHANNEL_LABEL,
  CONSENT_STATUS_LABEL,
  type ConsentStatus,
  type ConsentStatusInput,
  type ConsentStatusPage,
  type ConsentStatusRow,
} from '@seedgw/contracts/consents';
import { formatDateTime } from '@seedgw/contracts/format';
import { DataTable, type ColumnDef } from '@seedgw/ui/data-table';
import { exportConsentStatusAction } from '@/server/actions/consents-admin';

const STATUS_OPTIONS = [
  { value: 'da-dong-y', label: CONSENT_STATUS_LABEL.ACCEPTED },
  { value: 'da-rut', label: CONSENT_STATUS_LABEL.WITHDRAWN },
  { value: 'chua-tra-loi', label: CONSENT_STATUS_LABEL.NONE },
];

const STATUS_CLASS: Record<ConsentStatus, string> = {
  ACCEPTED: 'bg-brand-soft text-brand',
  WITHDRAWN: 'bg-danger-soft text-danger',
  NONE: 'bg-surface-subtle text-text-muted',
};

const COLUMNS: ColumnDef<ConsentStatusRow>[] = [
  {
    accessorKey: 'employeeCode',
    header: 'Nhân viên',
    meta: { label: 'Nhân viên' },
    cell: ({ row }) => (
      <>
        <span className="font-bold">{row.original.employeeCode}</span>
        <span className="block text-sm">{row.original.fullName}</span>
      </>
    ),
  },
  {
    accessorKey: 'orgUnitName',
    header: 'Đơn vị',
    meta: { label: 'Đơn vị', className: 'max-md:hidden min-w-48 whitespace-normal!' },
    cell: ({ row }) => row.original.orgUnitName ?? '',
  },
  {
    accessorKey: 'status',
    header: 'Tình trạng',
    meta: { label: 'Tình trạng' },
    cell: ({ row }) => (
      <span
        className={`inline-block rounded-md px-2 py-0.5 text-sm font-bold whitespace-nowrap ${STATUS_CLASS[row.original.status]}`}
      >
        {CONSENT_STATUS_LABEL[row.original.status]}
      </span>
    ),
  },
  {
    accessorKey: 'lastAt',
    header: 'Gần nhất',
    meta: { label: 'Gần nhất', className: 'max-md:hidden' },
    cell: ({ row }) =>
      row.original.lastAt ? (
        <>
          {formatDateTime(row.original.lastAt)}
          {row.original.lastChannel ? (
            <span className="block text-sm text-text-muted">
              {CONSENT_CHANNEL_LABEL[row.original.lastChannel]}
            </span>
          ) : null}
        </>
      ) : (
        ''
      ),
  },
  {
    id: 'certificate',
    header: 'Giấy xác nhận',
    meta: { label: 'Giấy xác nhận' },
    cell: ({ row }) =>
      row.original.lastRecordId ? (
        <Link
          href={`/giay-xac-nhan-dong-y/${row.original.lastRecordId}?ve=quan-tri`}
          className="font-bold whitespace-nowrap text-brand hover:underline"
        >
          Xem, in
        </Link>
      ) : (
        <span className="text-text-muted">Chưa có</span>
      ),
  },
];

function getRowId(row: ConsentStatusRow) {
  return row.userId;
}

export function ConsentExportButton({
  filter,
}: {
  filter: Pick<ConsentStatusInput, 'q' | 'status'>;
}) {
  return <DataTable.Export action={() => exportConsentStatusAction(filter)} />;
}

export function ConsentStatusTable({
  data,
  children,
}: {
  data: ConsentStatusPage;
  children?: ReactNode;
}) {
  return (
    <DataTable.Root
      columns={COLUMNS}
      data={data.items}
      getRowId={getRowId}
      total={data.total}
      page={data.page}
      pageSize={data.pageSize}
    >
      <DataTable.Toolbar>
        <DataTable.Search placeholder="Tìm theo mã hoặc họ tên" />
        <DataTable.Filters>
          <DataTable.SelectFilter
            param="trang-thai"
            label="Lọc theo tình trạng"
            allLabel="Mọi tình trạng"
            options={STATUS_OPTIONS}
          />
        </DataTable.Filters>
        {children}
      </DataTable.Toolbar>
      <DataTable.Body emptyMessage="Không có tài khoản nào phù hợp." />
      <DataTable.Pagination itemLabel="tài khoản" />
    </DataTable.Root>
  );
}
