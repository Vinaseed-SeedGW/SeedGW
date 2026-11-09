'use client';

import type { ReactNode } from 'react';
import { formatDate } from '@dms/contracts/format';
import type { ListUsersResult, UserStatus, UserSummary } from '@dms/contracts/users';
import { cn } from '@dms/ui/cn';
import { DataTable, selectionColumn, type ColumnDef } from '@dms/ui/data-table';

const STATUS_LABEL: Record<UserStatus, string> = {
  ACTIVE: 'Hoạt động',
  LOCKED: 'Đã khoá',
};

const STATUS_CLASS: Record<UserStatus, string> = {
  ACTIVE: 'bg-brand-soft text-brand',
  LOCKED: 'bg-danger-soft text-danger',
};

const STATUS_OPTIONS = (Object.keys(STATUS_LABEL) as UserStatus[]).map((value) => ({
  value,
  label: STATUS_LABEL[value],
}));

const SECONDARY_COLUMN = 'max-md:hidden';

const COLUMNS: ColumnDef<UserSummary>[] = [
  selectionColumn<UserSummary>(),
  {
    accessorKey: 'employeeCode',
    header: 'Mã nhân viên',
    meta: { label: 'Mã nhân viên', sortKey: 'employeeCode' },
  },
  {
    accessorKey: 'fullName',
    header: 'Họ tên',
    meta: { label: 'Họ tên', sortKey: 'fullName' },
  },
  {
    accessorKey: 'orgUnitName',
    header: 'Đơn vị',
    meta: { label: 'Đơn vị', className: SECONDARY_COLUMN },
  },
  {
    id: 'roles',
    header: 'Vai trò',
    cell: ({ row }) => row.original.roleNames.join(', '),
    meta: { label: 'Vai trò', className: SECONDARY_COLUMN },
  },
  {
    accessorKey: 'status',
    header: 'Trạng thái',
    meta: { label: 'Trạng thái' },
    cell: ({ row }) => (
      <span
        className={cn(
          'rounded-full px-2 py-0.5 text-xs font-bold',
          STATUS_CLASS[row.original.status],
        )}
      >
        {STATUS_LABEL[row.original.status]}
      </span>
    ),
  },
  {
    accessorKey: 'createdAt',
    header: 'Ngày tạo',
    cell: ({ row }) => formatDate(row.original.createdAt),
    meta: { label: 'Ngày tạo', sortKey: 'createdAt', className: SECONDARY_COLUMN },
  },
];

function getUserId(user: UserSummary) {
  return user.id;
}

type UsersTableProps = {
  data: ListUsersResult;
  children: ReactNode;
};

export function UsersTable({ data, children }: UsersTableProps) {
  return (
    <DataTable.Root
      columns={COLUMNS}
      data={data.items}
      getRowId={getUserId}
      total={data.total}
      page={data.page}
      pageSize={data.pageSize}
    >
      <DataTable.Toolbar>
        <DataTable.Search placeholder="Tìm theo mã hoặc họ tên" />
        <DataTable.Filters>
          <DataTable.SelectFilter
            param="trang-thai"
            label="Lọc theo trạng thái"
            allLabel="Tất cả trạng thái"
            options={STATUS_OPTIONS}
          />
        </DataTable.Filters>
        <DataTable.Columns />
        {children}
      </DataTable.Toolbar>
      <DataTable.BulkActions />
      <DataTable.Body emptyMessage="Không có tài khoản nào phù hợp." />
      <DataTable.Pagination itemLabel="tài khoản" />
    </DataTable.Root>
  );
}
