import 'server-only';
import type {
  ListRoutePlansInput,
  ListRoutePlansResult,
  MyRoutesResult,
  RoutePlanDetail,
} from '@seedgw/contracts/route-plans';
import { db } from '@seedgw/db/client';
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

export type RouteEditorContext = {
  owner: { id: string; employeeCode: string; fullName: string; isSelf: boolean };
  routes: MyRoutesResult;
};

/**
 * Dữ liệu trang đăng ký tuyến trên web. Không truyền mã nhân viên là tuyến của chính mình; có mã nhân viên
 * khác là Quản trị hệ thống đăng ký thay. null khi không có quyền hoặc không có nhân viên.
 */
export async function getRouteEditorContext(
  employeeCode: string | undefined,
): Promise<RouteEditorContext | null> {
  const user = await requireUser();
  assertCan(user, 'sales.route.read');
  const isSelf = !employeeCode || employeeCode === user.employeeCode;
  if (isSelf) {
    if (!can(user, 'sales.route.register')) return null;
    return {
      owner: { id: user.id, employeeCode: user.employeeCode, fullName: user.fullName, isSelf },
      routes: await readMyRoutes(user.id, true),
    };
  }
  if (!can(user, 'sales.approval.override')) return null;
  const owner = await db.user.findFirst({
    where: { employeeCode, isActive: true },
    select: { id: true, employeeCode: true, fullName: true },
  });
  if (!owner) return null;
  return { owner: { ...owner, isSelf }, routes: await readMyRoutes(owner.id, true) };
}
