import { notFound } from 'next/navigation';
import type { DepartmentSlug } from '@dms/contracts/departments';
import { findNavItem } from '@/features/shell/navigation';

type UnderConstructionProps = {
  slug: DepartmentSlug;
  segments: string[];
};

export function UnderConstruction({ slug, segments }: UnderConstructionProps) {
  const item = findNavItem(slug, `/${slug}/${segments.join('/')}`);
  if (!item) notFound();

  return (
    <>
      <h1 className="text-2xl font-bold text-brand">{item.label}</h1>
      <p className="mt-2 text-text-muted">Chức năng này đang được xây dựng.</p>
    </>
  );
}
