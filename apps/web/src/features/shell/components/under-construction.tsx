import { notFound } from 'next/navigation';
import type { DepartmentSlug } from '@seedgw/contracts/departments';
import { findNavItem } from '@/features/shell/navigation';
import { requirePathAccess } from '@/server/auth/can';

type UnderConstructionProps = {
  slug: DepartmentSlug;
  segments: string[];
};

export async function UnderConstruction({ slug, segments }: UnderConstructionProps) {
  const pathname = `/${slug}/${segments.join('/')}`;
  const item = findNavItem(slug, pathname);
  if (!item) notFound();
  await requirePathAccess(pathname);

  return (
    <>
      <h1 className="text-2xl font-bold text-brand">{item.label}</h1>
      <p className="mt-2 text-text-muted">Chức năng này đang được xây dựng.</p>
    </>
  );
}
