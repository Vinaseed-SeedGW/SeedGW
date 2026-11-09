import 'server-only';
import type { Prisma } from '@prisma/client';
import { escapeLikePattern, normalizeSearchText } from '@dms/contracts/text';
import type {
  ListUsersInput,
  ListUsersResult,
  UserEditValues,
  UserSummary,
} from '@dms/contracts/users';
import { z } from 'zod';
import { assertCan } from '@/server/auth/can';
import { requireUser } from '@/server/auth/current-user';
import { getScopedDb } from '@/server/auth/scoped-db';

export const USER_SUMMARY_SELECT = {
  id: true,
  employeeCode: true,
  fullName: true,
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

export async function getUserForEdit(id: string): Promise<UserEditValues | null> {
  if (!z.uuid().safeParse(id).success) return null;

  const [user, scoped] = await Promise.all([requireUser(), getScopedDb()]);
  assertCan(user, 'admin.user.manage');

  return scoped.user.findUnique({
    where: { id },
    select: { id: true, employeeCode: true, fullName: true, isActive: true },
  });
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
