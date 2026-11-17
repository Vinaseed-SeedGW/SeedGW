import 'server-only';
import type {
  ListRoutePlansInput,
  ListRoutePlansResult,
  MyRoutesResult,
  RoutePlanDetail,
} from '@dms/contracts/route-plans';
import { assertCan, can } from '@/server/auth/can';
import { requireUser } from '@/server/auth/current-user';
import { getScopedDb } from '@/server/auth/scoped-db';
import { listScopeRoutes, readMyRoutes, readRouteDetail } from '@/server/services/route-plans';

export async function getMyRoutes(): Promise<MyRoutesResult> {
  const user = await requireUser();
  assertCan(user, 'sales.route.read');
  return readMyRoutes(user.id, can(user, 'sales.route.register'));
}

export async function listRoutePlans(
  input: ListRoutePlansInput,
): Promise<ListRoutePlansResult & { week: string }> {
  const user = await requireUser();
  assertCan(user, 'sales.route.read');
  return listScopeRoutes(await getScopedDb(), input);
}

export async function getRoutePlan(id: string): Promise<RoutePlanDetail | null> {
  const user = await requireUser();
  assertCan(user, 'sales.route.read');
  return readRouteDetail(await getScopedDb(), id);
}
