import 'server-only';
import { DEPARTMENTS } from '@dms/contracts/departments';
import type { HubSummary } from '@dms/contracts/hub';
import { requireUser } from '@/server/auth/current-user';
import { canViewExecutive, getRoleCodes } from '@/server/auth/roles';

export async function getHubSummary(): Promise<HubSummary> {
  const user = await requireUser();
  const roleCodes = await getRoleCodes(user.id);

  return {
    // So viec cho va thong bao se co du lieu that tu cac task nghiep vu.
    departments: DEPARTMENTS.map((department) => ({ ...department, pendingCount: 0 })),
    canViewExecutive: canViewExecutive(roleCodes),
    notifications: [],
  };
}
