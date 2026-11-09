import { redirect } from 'next/navigation';
import { departmentLanding } from '@dms/contracts/departments';
import { requireUser } from '@/server/auth/current-user';
import { getRoleCodes } from '@/server/auth/roles';

export default async function QuanTriPage() {
  const user = await requireUser();
  redirect(departmentLanding('quan-tri', await getRoleCodes(user.id)));
}
