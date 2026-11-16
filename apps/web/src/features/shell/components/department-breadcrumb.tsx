'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { activeNavHref } from '@dms/contracts/access';

type DepartmentBreadcrumbProps = {
  departmentName: string;
  pages: ReadonlyArray<{ href: string; label: string }>;
};

export function DepartmentBreadcrumb({ departmentName, pages }: DepartmentBreadcrumbProps) {
  const pathname = usePathname();
  const active = activeNavHref(
    pathname,
    pages.map((item) => item.href),
  );
  const page = pages.find((item) => item.href === active);

  return (
    <>
      <Link href="/hub" className="text-brand">
        Hub
      </Link>
      {' / '}
      {departmentName}
      {page ? ` / ${page.label}` : null}
    </>
  );
}
