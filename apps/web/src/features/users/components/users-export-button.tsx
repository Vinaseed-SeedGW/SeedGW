'use client';

import type { ListUsersInput } from '@dms/contracts/users';
import { DataTable } from '@dms/ui/data-table';
import { exportUsersAction } from '@/server/actions/users';

type UsersExportButtonProps = {
  filter: Pick<ListUsersInput, 'q' | 'status' | 'sort'>;
};

export function UsersExportButton({ filter }: UsersExportButtonProps) {
  return <DataTable.Export action={(ids) => exportUsersAction(filter, ids)} />;
}
