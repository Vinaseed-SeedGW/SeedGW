import type { ReactNode } from 'react';
import { DepartmentLayout } from '@/features/shell/components/department-layout';

export default function CskhLayout({ children }: { children: ReactNode }) {
  return <DepartmentLayout slug="cskh">{children}</DepartmentLayout>;
}
