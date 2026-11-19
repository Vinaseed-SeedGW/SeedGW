import 'server-only';
import type { Prisma } from '@prisma/client';
import { escapeLikePattern, normalizeSearchText } from '@seedgw/contracts/text';
import type {
  ListUsersInput,
  ListUsersResult,
  SelectOption,
  UserDetail,
  UserFormOptions,
  UserSummary,
} from '@seedgw/contracts/users';
import { db } from '@seedgw/db/client';
import { z } from 'zod';
import { assertCan } from '@/server/auth/can';
import { requireUser } from '@/server/auth/current-user';
import { getAssignableOrgUnitIds, getScopedDb } from '@/server/auth/scoped-db';
import {
  allowedActionsFor,
  dateToInput,
  exceedsActor,
  ROLE_PERMISSIONS_SELECT,
  USER_ROLES_SELECT,
} from '@/server/services/users';

export const USER_SUMMARY_SELECT = {
  id: true,
  employeeCode: true,
  fullName: true,
  jobTitle: true,
  isActive: true,
  createdAt: true,
  orgUnit: { select: { name: true } },
  roles: { select: { role: { select: { name: true } } } },
} satisfies Prisma.UserSelect;

type UserSummaryRow = Prisma.UserGetPayload<{ select: typeof USER_SUMMARY_SELECT }>;

export function toUserSummary(row: UserSummaryRow): UserSummary {
  return {
    id: row.id,
    employeeCode: row.employeeCode,
    fullName: row.fullName,
    orgUnitName: row.orgUnit?.name ?? null,
    jobTitle: row.jobTitle,
    roleNames: row.roles.map((userRole) => userRole.role.name),
    status: row.isActive ? 'ACTIVE' : 'LOCKED',
    createdAt: row.createdAt.toISOString(),
  };
}

export function userWhere({ q, status }: Pick<ListUsersInput, 'q' | 'status'>) {
  const search = q ? normalizeSearchText(q) : '';
  return {
    ...(search ? { searchText: { contains: escapeLikePattern(search) } } : {}),
    ...(status ? { isActive: status === 'ACTIVE' } : {}),
  } satisfies Prisma.UserWhereInput;
}

export function userOrderBy(sort: ListUsersInput['sort']): Prisma.UserOrderByWithRelationInput[] {
  const direction = sort.startsWith('-') ? 'desc' : 'asc';
  const field = sort.replace('-', '') as 'employeeCode' | 'fullName' | 'createdAt';
  return [{ [field]: direction }, { id: 'asc' }];
}

export async function getUserDetail(id: string): Promise<UserDetail | null> {
  if (!z.uuid().safeParse(id).success) return null;

  const [user, scoped] = await Promise.all([requireUser(), getScopedDb()]);
  assertCan(user, 'admin.user.manage');

  const row = await scoped.user.findUnique({
    where: { id },
    select: {
      id: true,
      employeeCode: true,
      fullName: true,
      phone: true,
      email: true,
      jobTitle: true,
      hiredAt: true,
      orgUnitId: true,
      managerId: true,
      isActive: true,
      mustChangePassword: true,
      loginLockedUntil: true,
      roles: USER_ROLES_SELECT,
      mobileDevices: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          platform: true,
          status: true,
          lastSeenAt: true,
          isRooted: true,
          createdAt: true,
        },
      },
    },
  });
  if (!row) return null;

  const isLoginLocked = row.loginLockedUntil !== null && row.loginLockedUntil > new Date();
  return {
    id: row.id,
    employeeCode: row.employeeCode,
    fullName: row.fullName,
    phone: row.phone ?? '',
    email: row.email ?? '',
    jobTitle: row.jobTitle ?? '',
    hiredAt: dateToInput(row.hiredAt),
    orgUnitId: row.orgUnitId,
    managerId: row.managerId,
    roleIds: row.roles.map(({ role }) => role.id),
    roleNames: row.roles.map(({ role }) => role.name),
    status: row.isActive ? 'ACTIVE' : 'LOCKED',
    mustChangePassword: row.mustChangePassword,
    loginLockedUntil: isLoginLocked ? (row.loginLockedUntil?.toISOString() ?? null) : null,
    devices: row.mobileDevices.map((device) => ({
      ...device,
      lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
      createdAt: device.createdAt.toISOString(),
    })),
    allowed: allowedActionsFor(user, row),
  };
}

type FormOptionsContext = { editingUserId: string | null; currentManagerId: string | null };

export function buildOrgUnitLabels(
  units: ReadonlyArray<{ id: string; name: string; parentId: string | null }>,
): SelectOption[] {
  const byId = new Map(units.map((unit) => [unit.id, unit]));

  function pathOf(unit: { name: string; parentId: string | null }): string {
    const parent = unit.parentId ? byId.get(unit.parentId) : undefined;
    return parent ? `${pathOf(parent)} / ${unit.name}` : unit.name;
  }

  return units
    .map((unit) => ({ value: unit.id, label: pathOf(unit) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'vi'));
}

export async function getUserFormOptions({
  editingUserId,
  currentManagerId,
}: FormOptionsContext): Promise<UserFormOptions> {
  const [user, scoped, assignableUnits] = await Promise.all([
    requireUser(),
    getScopedDb(),
    getAssignableOrgUnitIds(),
  ]);
  assertCan(user, 'admin.user.manage');

  const [units, roles, managers] = await Promise.all([
    db.orgUnit.findMany({ select: { id: true, name: true, parentId: true } }),
    db.role.findMany({ orderBy: { name: 'asc' }, select: ROLE_PERMISSIONS_SELECT }),
    scoped.user.findMany({
      // Giu lai quan ly hien tai du da bi khoa, neu khong o chon se am tham xoa gia tri.
      where: {
        OR: [{ isActive: true }, ...(currentManagerId ? [{ id: currentManagerId }] : [])],
        ...(editingUserId ? { id: { not: editingUserId } } : {}),
      },
      orderBy: { employeeCode: 'asc' },
      select: { id: true, employeeCode: true, fullName: true },
    }),
  ]);

  const labels = buildOrgUnitLabels(units);
  return {
    orgUnits: assignableUnits ? labels.filter((unit) => assignableUnits.has(unit.value)) : labels,
    roles: roles
      .filter((role) => !exceedsActor(user, [role]))
      .map((role) => ({ value: role.id, label: role.name })),
    managers: managers.map((manager) => ({
      value: manager.id,
      label: `${manager.employeeCode} - ${manager.fullName}`,
    })),
  };
}

export async function listUsers(input: ListUsersInput): Promise<ListUsersResult> {
  const [user, scoped] = await Promise.all([requireUser(), getScopedDb()]);
  assertCan(user, 'admin.user.read');

  const where = userWhere(input);
  const [rows, total] = await Promise.all([
    scoped.user.findMany({
      where,
      orderBy: userOrderBy(input.sort),
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
      select: USER_SUMMARY_SELECT,
    }),
    scoped.user.count({ where }),
  ]);

  return {
    items: rows.map(toUserSummary),
    total,
    page: input.page,
    pageSize: input.pageSize,
  };
}
