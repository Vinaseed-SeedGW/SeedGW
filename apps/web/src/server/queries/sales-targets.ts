import 'server-only';
import type {
  ListSalesTargetsInput,
  ListSalesTargetsResult,
  MyTargetsResult,
} from '@dms/contracts/sales-targets';
import { db } from '@dms/db/client';
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

/** Nhân viên đang hoạt động để Quản trị hệ thống chọn khi đăng ký thay. */
export async function getOnBehalfEmployees(): Promise<Array<{ value: string; label: string }>> {
  const user = await requireUser();
  assertCan(user, 'sales.approval.override');
  const rows = await db.user.findMany({
    where: { isActive: true },
    orderBy: { employeeCode: 'asc' },
    select: { id: true, employeeCode: true, fullName: true, orgUnit: { select: { name: true } } },
  });
  return rows.map((row) => ({
    value: row.id,
    label: `${row.employeeCode} ${row.fullName}${row.orgUnit ? `, ${row.orgUnit.name}` : ''}`,
  }));
}
