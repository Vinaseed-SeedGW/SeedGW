import { redirect } from 'next/navigation';
import { departmentLanding } from '@dms/contracts/access';
import { requireDepartmentAccess } from '@/server/auth/can';

export default async function TraoDoiPage() {
  const user = await requireDepartmentAccess('trao-doi');
  redirect(departmentLanding('trao-doi', user.roleCodes, user.permissions));
}
