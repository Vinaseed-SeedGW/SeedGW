import 'server-only';
import type { PermissionCode } from '@dms/contracts/access';
import type { DayMapFilterOptions } from '@dms/contracts/check-ins';
import { db } from '@dms/db/client';
import { getOrgUnitTreeIds } from '@dms/db/org-units';
import { assertCan } from '@/server/auth/can';
import { requireUser } from '@/server/auth/current-user';
import { getAssignableOrgUnitIds, getScopedDb } from '@/server/auth/scoped-db';
import { buildOrgUnitLabels } from '@/server/queries/users';

/**
 * Đơn vị và nhân viên cho bộ lọc (bản đồ hành trình, dashboard), chỉ trong phạm vi của người xem.
 * Nhân viên chỉ thấy chính mình. Chọn đơn vị thì danh sách nhân viên gồm cả đơn vị con.
 */
export async function getPeopleFilterOptions(
  orgUnitId: string | null,
  permission: PermissionCode,
): Promise<DayMapFilterOptions> {
  const user = await requireUser();
  assertCan(user, permission);
  const [scoped, assignable] = await Promise.all([getScopedDb(), getAssignableOrgUnitIds()]);
  const unitIds = orgUnitId ? await getOrgUnitTreeIds(orgUnitId) : null;
  const [units, employees] = await Promise.all([
    db.orgUnit.findMany({ select: { id: true, name: true, parentId: true } }),
    scoped.user.findMany({
      where: { isActive: true, ...(unitIds ? { orgUnitId: { in: [...unitIds] } } : {}) },
      orderBy: { employeeCode: 'asc' },
      select: { employeeCode: true, fullName: true, orgUnit: { select: { name: true } } },
    }),
  ]);
  const labels = buildOrgUnitLabels(units);
  const visibleUnits = assignable ? labels.filter((unit) => assignable.has(unit.value)) : labels;
  return {
    orgUnits: visibleUnits.map((unit) => ({ id: unit.value, name: unit.label })),
    employees: employees.map((row) => ({
      code: row.employeeCode,
      name: row.fullName,
      orgUnitName: row.orgUnit?.name ?? null,
    })),
  };
}
