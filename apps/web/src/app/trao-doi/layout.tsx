import type { ReactNode } from 'react';
import { DepartmentLayout } from '@/features/shell/components/department-layout';

export default function TraoDoiLayout({ children }: { children: ReactNode }) {
  return <DepartmentLayout slug="trao-doi">{children}</DepartmentLayout>;
}
