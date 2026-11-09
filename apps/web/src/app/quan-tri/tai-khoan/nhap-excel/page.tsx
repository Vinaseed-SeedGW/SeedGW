import type { Metadata } from 'next';
import Link from 'next/link';
import { UserImportWizard } from '@/features/users/components/user-import-wizard';
import { requirePermission } from '@/server/auth/can';

export const metadata: Metadata = { title: 'Nhập tài khoản từ Excel' };

export default async function ImportAccountsPage() {
  await requirePermission('admin.user.manage');

  return (
    <>
      <Link href="/quan-tri/tai-khoan" className="text-sm text-brand">
        Tài khoản
      </Link>
      <h1 className="mt-1 text-2xl font-bold text-brand">Nhập tài khoản từ Excel</h1>
      <UserImportWizard />
    </>
  );
}
