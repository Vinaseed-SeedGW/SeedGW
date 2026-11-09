import 'server-only';
import { canAccessDepartment } from '@dms/contracts/access';
import { DEPARTMENTS } from '@dms/contracts/departments';
import type { HubSummary } from '@dms/contracts/hub';
import { requireUser } from '@/server/auth/current-user';

export async function getHubSummary(): Promise<HubSummary> {
  const user = await requireUser();

  return {
    // So viec cho va thong bao se co du lieu that tu cac task nghiep vu.
    departments: DEPARTMENTS.filter((department) =>
      canAccessDepartment(user.permissions, department.slug),
    ).map((department) => ({ ...department, pendingCount: 0 })),
    notifications: [],
  };
}
