'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { createContext, use, useState, type ReactNode } from 'react';
import type { ListUsersResult, UserEditValues, UserSummary } from '@dms/contracts/users';
import type { ColumnDef } from '@dms/ui/data-table';
import {
  CODE_COLUMN,
  DETAIL_COLUMNS,
  SELECT_COLUMN,
  UsersTableView,
} from '@/features/users/components/users-table';

// Form va Zod chi tai khi can sua, trang danh sach khong phai mang theo.
const UserEditSheet = dynamic(
  () => import('@/features/users/components/user-edit-sheet').then((m) => m.UserEditSheet),
  { ssr: false },
);

function preloadEditSheet() {
  void import('@/features/users/components/user-edit-sheet');
}

const OpenEditContext = createContext<((user: UserEditValues) => void) | null>(null);

function EditButton({ user }: { user: UserSummary }) {
  const openEdit = use(OpenEditContext);
  return (
    <button
      type="button"
      className="text-brand"
      onPointerEnter={preloadEditSheet}
      onFocus={preloadEditSheet}
      onClick={() =>
        openEdit?.({
          id: user.id,
          employeeCode: user.employeeCode,
          fullName: user.fullName,
          isActive: user.status === 'ACTIVE',
        })
      }
    >
      Sửa
    </button>
  );
}

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
  {
    id: 'actions',
    enableHiding: false,
    header: () => <span className="sr-only">Thao tác</span>,
    cell: ({ row }) => <EditButton user={row.original} />,
  },
];

type ManagedUsersTableProps = {
  data: ListUsersResult;
  children: ReactNode;
};

export function ManagedUsersTable({ data, children }: ManagedUsersTableProps) {
  const [editing, setEditing] = useState<UserEditValues | null>(null);

  return (
    <OpenEditContext value={setEditing}>
      <UsersTableView columns={MANAGED_COLUMNS} data={data}>
        {children}
      </UsersTableView>
      {editing ? <UserEditSheet user={editing} onClose={() => setEditing(null)} /> : null}
    </OpenEditContext>
  );
}
