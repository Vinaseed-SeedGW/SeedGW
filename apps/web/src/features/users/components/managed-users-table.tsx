'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import type { ListUsersResult, UserSummary } from '@seedgw/contracts/users';
import type { ColumnDef } from '@seedgw/ui/data-table';
import { UsersBulkActions } from '@/features/users/components/users-bulk-actions';
import {
  CODE_COLUMN,
  DETAIL_COLUMNS,
  SELECT_COLUMN,
  UsersTableView,
} from '@/features/users/components/users-table';

const MANAGED_COLUMNS: ColumnDef<UserSummary>[] = [
  SELECT_COLUMN,
  {
    ...CODE_COLUMN,
    cell: ({ row }) => (
      <Link href={`/quan-tri/tai-khoan/${row.original.id}`} className="text-brand">
        {row.original.employeeCode}
      </Link>
    ),
  },
  ...DETAIL_COLUMNS,
];

type ManagedUsersTableProps = {
  data: ListUsersResult;
  children: ReactNode;
};

export function ManagedUsersTable({ data, children }: ManagedUsersTableProps) {
  return (
    <UsersTableView columns={MANAGED_COLUMNS} data={data} bulkActions={<UsersBulkActions />}>
      {children}
    </UsersTableView>
  );
}
