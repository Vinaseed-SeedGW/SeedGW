'use client';

import type { ReactNode } from 'react';
import { formatDate } from '@seedgw/contracts/format';
import type { ListUsersResult, UserStatus, UserSummary } from '@seedgw/contracts/users';
import { DataTable, selectionColumn, type ColumnDef } from '@seedgw/ui/data-table';
import { USER_STATUS_LABEL, UserStatusBadge } from '@/features/users/components/user-status-badge';

const STATUS_OPTIONS = (Object.keys(USER_STATUS_LABEL) as UserStatus[]).map((value) => ({
  value,
  label: USER_STATUS_LABEL[value],
}));

const SECONDARY_COLUMN = 'max-md:hidden';

export const SELECT_COLUMN = selectionColumn<UserSummary>();

export const CODE_COLUMN: ColumnDef<UserSummary> = {
  accessorKey: 'employeeCode',
  header: 'Mã nhân viên',
  meta: { label: 'Mã nhân viên', sortKey: 'employeeCode' },
};

export const DETAIL_COLUMNS: ColumnDef<UserSummary>[] = [
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
    accessorKey: 'jobTitle',
    header: 'Chức danh',
    meta: { label: 'Chức danh', className: SECONDARY_COLUMN },
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
    cell: ({ row }) => <UserStatusBadge status={row.original.status} />,
  },
  {
    accessorKey: 'createdAt',
    header: 'Ngày tạo',
    cell: ({ row }) => formatDate(row.original.createdAt),
    meta: { label: 'Ngày tạo', sortKey: 'createdAt', className: SECONDARY_COLUMN },
  },
];

const READ_ONLY_COLUMNS: ColumnDef<UserSummary>[] = [SELECT_COLUMN, CODE_COLUMN, ...DETAIL_COLUMNS];

function getUserId(user: UserSummary) {
  return user.id;
}

type UsersTableViewProps = {
  columns: ColumnDef<UserSummary>[];
  data: ListUsersResult;
  bulkActions?: ReactNode;
  children: ReactNode;
};

export function UsersTableView({ columns, data, bulkActions, children }: UsersTableViewProps) {
  return (
    <DataTable.Root
      columns={columns}
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
      <DataTable.BulkActions>{bulkActions}</DataTable.BulkActions>
      <DataTable.Body emptyMessage="Không có tài khoản nào phù hợp." />
      <DataTable.Pagination itemLabel="tài khoản" />
    </DataTable.Root>
  );
}

type UsersTableProps = {
  data: ListUsersResult;
  children: ReactNode;
};

export function UsersTable({ data, children }: UsersTableProps) {
  return (
    <UsersTableView columns={READ_ONLY_COLUMNS} data={data}>
      {children}
    </UsersTableView>
  );
}
