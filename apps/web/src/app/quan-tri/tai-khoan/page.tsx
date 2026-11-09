import type { Metadata } from 'next';
import { Suspense } from 'react';
import { usersUrlParams, type ListUsersInput } from '@dms/contracts/users';
import { DataTableSkeleton } from '@dms/ui/data-table-skeleton';
import { Can } from '@/features/auth/components/can';
import { UsersExportButton } from '@/features/users/components/users-export-button';
import { UsersTable } from '@/features/users/components/users-table';
import { requirePermission } from '@/server/auth/can';
import { listUsers } from '@/server/queries/users';

export const metadata: Metadata = { title: 'Tài khoản' };

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AccountsPage({ searchParams }: PageProps) {
  await requirePermission('admin.user.read');
  const input = usersUrlParams.parse(await searchParams);

  return (
    <>
      <h1 className="text-2xl font-bold text-brand">Tài khoản</h1>
      {/* Khong dat key theo bo loc de thanh cong cu khong mat focus khi dang go tim kiem. */}
      <Suspense fallback={<DataTableSkeleton columns={6} rows={10} />}>
        <AccountsResults input={input} />
      </Suspense>
    </>
  );
}

async function AccountsResults({ input }: { input: ListUsersInput }) {
  const data = await listUsers(input);

  return (
    <UsersTable data={data}>
      <Can permission="admin.user.export">
        <UsersExportButton filter={{ q: input.q, status: input.status, sort: input.sort }} />
      </Can>
    </UsersTable>
  );
}
