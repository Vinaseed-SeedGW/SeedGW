import type { Metadata } from 'next';
import Link from 'next/link';
import { z } from 'zod';
import { ManagerImportWizard } from '@/features/users/components/manager-import-wizard';
import { UserImportWizard } from '@/features/users/components/user-import-wizard';
import { requirePermission } from '@/server/auth/can';

export const metadata: Metadata = { title: 'Nhập tài khoản từ Excel' };

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const TABS = [
  { value: 'tao-moi', label: 'Tạo tài khoản mới' },
  { value: 'quan-ly', label: 'Cập nhật Quản lý trực tiếp' },
] as const;

const tabParam = z.object({ tab: z.enum(['tao-moi', 'quan-ly']).catch('tao-moi') });

export default async function ImportAccountsPage({ searchParams }: PageProps) {
  await requirePermission('admin.user.manage');
  const { tab } = tabParam.parse(await searchParams);

  return (
    <>
      <Link href="/quan-tri/tai-khoan" className="text-sm text-brand">
        Tài khoản
      </Link>
      <h1 className="mt-1 text-2xl font-bold text-brand">Nhập tài khoản từ Excel</h1>
      <nav aria-label="Loại nhập" className="mt-4 flex gap-2 border-b border-border">
        {TABS.map((item) => (
          <Link
            key={item.value}
            href={`/quan-tri/tai-khoan/nhap-excel?tab=${item.value}`}
            aria-current={item.value === tab ? 'page' : undefined}
            className={`-mb-px border-b-2 px-3 py-2 font-bold ${
              item.value === tab
                ? 'border-brand text-brand'
                : 'border-transparent text-text-muted hover:text-brand'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {tab === 'quan-ly' ? <ManagerImportWizard /> : <UserImportWizard />}
    </>
  );
}
