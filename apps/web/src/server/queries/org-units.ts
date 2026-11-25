import 'server-only';
import type { ManagerOption, OrgUnitAssignScope, OrgUnitRow } from '@seedgw/contracts/org-units';
import { PROVINCES } from '@seedgw/contracts/provinces';
import { db } from '@seedgw/db/client';
import { assertCan } from '@/server/auth/can';
import { requireUser } from '@/server/auth/current-user';
import { getAssignableOrgUnitIds, getScopedDb } from '@/server/auth/scoped-db';

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
      hasManagerLevel: true,
      routeKind: true,
      manager: { select: { fullName: true } },
      _count: { select: { users: true } },
      provinces: { select: { provinceName: true } },
    },
  });

  return rows.map(({ manager, _count, provinces, ...row }) => ({
    ...row,
    managerName: manager?.fullName ?? null,
    memberCount: _count.users,
    provinces: PROVINCES.filter((name) => provinces.some((item) => item.provinceName === name)),
  }));
}

export async function getOrgUnitAssignScope(): Promise<OrgUnitAssignScope> {
  const [user, scoped, assignableUnits] = await Promise.all([
    requireUser(),
    getScopedDb(),
    getAssignableOrgUnitIds(),
  ]);
  assertCan(user, 'admin.org-unit.assign');

  const rows = await scoped.user.findMany({
    where: { isActive: true },
    orderBy: { employeeCode: 'asc' },
    select: { id: true, employeeCode: true, fullName: true },
  });
  return {
    assignableUnitIds: assignableUnits ? [...assignableUnits] : null,
    managerOptions: rows.map((row) => ({
      value: row.id,
      label: `${row.employeeCode} - ${row.fullName}`,
    })),
  };
}

export async function listManagerOptions(): Promise<ManagerOption[]> {
  const user = await requireUser();
  assertCan(user, 'admin.org-unit.manage');

  // pham-vi-toan-bo: chỉ người có quyền admin.org-unit.manage (Quản trị hệ thống) chọn Trưởng đơn vị.
  const rows = await db.user.findMany({
    where: { isActive: true },
    orderBy: { employeeCode: 'asc' },
    select: { id: true, employeeCode: true, fullName: true },
  });
  return rows.map((row) => ({ value: row.id, label: `${row.employeeCode} - ${row.fullName}` }));
}
