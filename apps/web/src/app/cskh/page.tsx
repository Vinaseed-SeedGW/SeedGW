import { redirect } from 'next/navigation';
import { departmentLanding } from '@dms/contracts/access';
import { requireDepartmentAccess } from '@/server/auth/can';

export default async function CskhPage() {
  const user = await requireDepartmentAccess('cskh');
  redirect(departmentLanding('cskh', user.roleCodes, user.permissions));
}
