import 'server-only';
import type { AssignmentsResult } from '@seedgw/contracts/target-assignments';
import { assertCan } from '@/server/auth/can';
import { requireUser } from '@/server/auth/current-user';
import { listAssignments } from '@/server/services/target-assignments';

export async function getTargetAssignments(month: string): Promise<AssignmentsResult> {
  const user = await requireUser();
  assertCan(user, 'sales.target.assign');
  return listAssignments(month);
}
