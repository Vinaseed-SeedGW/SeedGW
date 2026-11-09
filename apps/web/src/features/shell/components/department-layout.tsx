import Link from 'next/link';
import type { ReactNode } from 'react';
import { DEPARTMENTS, type DepartmentSlug } from '@dms/contracts/departments';
import { LogoutButton } from '@/features/auth/components/logout-button';
import { requireUser } from '@/server/auth/current-user';

type DepartmentLayoutProps = {
  slug: DepartmentSlug;
  children: ReactNode;
};

export async function DepartmentLayout({ slug, children }: DepartmentLayoutProps) {
  const user = await requireUser();
  const department = DEPARTMENTS.find((item) => item.slug === slug);

  return (
    <div style={{ padding: 16 }}>
      <header>
        <Link href="/hub">Hub</Link> / <b>{department?.name}</b> / {user.fullName}
        <LogoutButton />
      </header>
      <main>{children}</main>
    </div>
  );
}
