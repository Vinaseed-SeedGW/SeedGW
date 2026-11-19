import { redirect } from 'next/navigation';
import { departmentLanding } from '@seedgw/contracts/access';
import { requireDepartmentAccess } from '@/server/auth/can';

export default async function QuanTriPage() {
  const user = await requireDepartmentAccess('quan-tri');
  redirect(departmentLanding('quan-tri', user.roleCodes, user.permissions));
}
