import 'server-only';
import type { DayMapFilterOptions, DayMapInput, DayMapResult } from '@dms/contracts/check-ins';
import { db } from '@dms/db/client';
import { getOrgUnitTreeIds } from '@dms/db/org-units';
import { assertCan } from '@/server/auth/can';
import { requireUser } from '@/server/auth/current-user';
import { getAssignableOrgUnitIds, getScopedDb } from '@/server/auth/scoped-db';
import { buildOrgUnitLabels } from '@/server/queries/users';
import { readDayMap } from '@/server/services/day-map';

// Bản đồ hành trình (V2b): người xem chỉ thấy nhân viên trong phạm vi dữ liệu của mình.
export async function getDayMap(input: DayMapInput): Promise<DayMapResult | null> {
  const user = await requireUser();
  assertCan(user, 'sales.check-in.read');
  if (!input.employeeCode) return null;
  return readDayMap(input.employeeCode, input.day);
}

/** Đơn vị và nhân viên cho bộ lọc. Nhân viên chỉ thấy chính mình. */
export async function getDayMapFilterOptions(
  orgUnitId: string | null,
): Promise<DayMapFilterOptions> {
  const user = await requireUser();
  assertCan(user, 'sales.check-in.read');
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
