import type { ReactNode } from 'react';
import { DepartmentLayout } from '@/features/shell/components/department-layout';

export default function KinhDoanhLayout({ children }: { children: ReactNode }) {
  return <DepartmentLayout slug="kinh-doanh">{children}</DepartmentLayout>;
}
