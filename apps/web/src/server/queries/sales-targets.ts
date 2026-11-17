import 'server-only';
import type {
  ListSalesTargetsInput,
  ListSalesTargetsResult,
  MyTargetsResult,
} from '@dms/contracts/sales-targets';
import { assertCan, can } from '@/server/auth/can';
import { requireUser } from '@/server/auth/current-user';
import { getScopedDb } from '@/server/auth/scoped-db';
import { listScopeTargets, readMyTargets } from '@/server/services/sales-targets';

export async function getMyTargets(): Promise<MyTargetsResult> {
  const user = await requireUser();
  assertCan(user, 'sales.target.read');
  return readMyTargets(user.id, can(user, 'sales.target.register'));
}

export async function listSalesTargets(
  input: ListSalesTargetsInput,
): Promise<ListSalesTargetsResult & { month: string }> {
  const user = await requireUser();
  assertCan(user, 'sales.target.read');
  return listScopeTargets(await getScopedDb(), input);
}
