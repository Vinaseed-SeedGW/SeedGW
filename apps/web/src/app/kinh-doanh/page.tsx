import { redirect } from 'next/navigation';
import { departmentLanding } from '@seedgw/contracts/access';
import { requireDepartmentAccess } from '@/server/auth/can';

export default async function KinhDoanhPage() {
  const user = await requireDepartmentAccess('kinh-doanh');
  redirect(departmentLanding('kinh-doanh', user.roleCodes, user.permissions));
}
