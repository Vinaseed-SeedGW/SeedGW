import type { ReactNode } from 'react';
import { DepartmentLayout } from '@/features/shell/components/department-layout';

export default function QuanTriLayout({ children }: { children: ReactNode }) {
  return <DepartmentLayout slug="quan-tri">{children}</DepartmentLayout>;
}
