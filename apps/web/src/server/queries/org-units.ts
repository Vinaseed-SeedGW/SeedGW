import 'server-only';
import type { ManagerOption, OrgUnitRow } from '@dms/contracts/org-units';
import { db } from '@dms/db/client';
import { assertCan } from '@/server/auth/can';
import { requireUser } from '@/server/auth/current-user';

export async function listOrgUnits(): Promise<OrgUnitRow[]> {
  const user = await requireUser();
  assertCan(user, 'admin.org-unit.read');

  const rows = await db.orgUnit.findMany({
    select: {
      id: true,
      code: true,
      name: true,
      parentId: true,
      managerId: true,
      manager: { select: { fullName: true } },
      _count: { select: { users: true } },
    },
  });

  return rows.map(({ manager, _count, ...row }) => ({
    ...row,
    managerName: manager?.fullName ?? null,
    memberCount: _count.users,
  }));
}

export async function listManagerOptions(): Promise<ManagerOption[]> {
  const user = await requireUser();
  assertCan(user, 'admin.org-unit.manage');

  const rows = await db.user.findMany({
    where: { isActive: true },
    orderBy: { employeeCode: 'asc' },
    select: { id: true, employeeCode: true, fullName: true },
  });
  return rows.map((row) => ({ value: row.id, label: `${row.employeeCode} - ${row.fullName}` }));
}
