'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type DepartmentBreadcrumbProps = {
  departmentName: string;
  pages: ReadonlyArray<{ href: string; label: string }>;
};

export function DepartmentBreadcrumb({ departmentName, pages }: DepartmentBreadcrumbProps) {
  const pathname = usePathname();
  const page = pages.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));

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
