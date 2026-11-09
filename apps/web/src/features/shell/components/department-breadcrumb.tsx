'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { DEPARTMENTS, type DepartmentSlug } from '@dms/contracts/departments';
import { DEPARTMENT_NAV } from '@/features/shell/navigation';

export function DepartmentBreadcrumb({ slug }: { slug: DepartmentSlug }) {
  const pathname = usePathname();
  const department = DEPARTMENTS.find((item) => item.slug === slug);
  const page = DEPARTMENT_NAV[slug]
    .flatMap((group) => group.items)
    .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));

  return (
    <>
      <Link href="/hub" className="text-brand">
        Hub
      </Link>
      {' / '}
      {department?.name}
      {page ? ` / ${page.label}` : null}
    </>
  );
}
