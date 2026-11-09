import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { usersUrlParams, type ListUsersInput } from '@dms/contracts/users';
import { DataTableSkeleton } from '@dms/ui/data-table-skeleton';
import { Can } from '@/features/auth/components/can';
import { ManagedUsersTable } from '@/features/users/components/managed-users-table';
import { UsersExportButton } from '@/features/users/components/users-export-button';
import { UsersTable } from '@/features/users/components/users-table';
import { can, requirePermission } from '@/server/auth/can';
import { requireUser } from '@/server/auth/current-user';
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-brand">Tài khoản</h1>
        <Can permission="admin.user.manage">
          <div className="flex flex-wrap gap-2">
            <Link
              href="/quan-tri/tai-khoan/nhap-excel"
              className="inline-flex h-9.5 items-center rounded-md border border-brand bg-surface px-4 font-bold text-brand hover:bg-brand-soft"
            >
              Nhập từ Excel
            </Link>
            <Link
              href="/quan-tri/tai-khoan/tao-moi"
              className="inline-flex h-9.5 items-center rounded-md bg-brand px-4 font-bold text-primary-foreground hover:bg-brand-hover"
            >
              Tạo tài khoản
            </Link>
          </div>
        </Can>
      </div>
      {/* Khong dat key theo bo loc de thanh cong cu khong mat focus khi dang go tim kiem. */}
      <Suspense fallback={<DataTableSkeleton columns={7} rows={10} />}>
        <AccountsResults input={input} />
      </Suspense>
    </>
  );
}

async function AccountsResults({ input }: { input: ListUsersInput }) {
  const [user, data] = await Promise.all([requireUser(), listUsers(input)]);
  const exportButton = (
    <Can permission="admin.user.export">
      <UsersExportButton filter={{ q: input.q, status: input.status, sort: input.sort }} />
    </Can>
  );

  return can(user, 'admin.user.manage') ? (
    <ManagedUsersTable data={data}>{exportButton}</ManagedUsersTable>
  ) : (
    <UsersTable data={data}>{exportButton}</UsersTable>
  );
}
