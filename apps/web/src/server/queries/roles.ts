import 'server-only';
import { isPresetRole, roleLockReason, type RoleMatrixRole } from '@seedgw/contracts/roles';
import { db } from '@seedgw/db/client';
import { assertCan } from '@/server/auth/can';
import { requireUser } from '@/server/auth/current-user';
import { ROLE_MATRIX_SELECT } from '@/server/services/roles';

export async function getRoleMatrix(): Promise<RoleMatrixRole[]> {
  const user = await requireUser();
  assertCan(user, 'admin.role.read');

  const rows = await db.role.findMany({
    orderBy: [{ createdAt: 'asc' }, { name: 'asc' }],
    select: {
      ...ROLE_MATRIX_SELECT,
      users: { where: { userId: user.id }, select: { userId: true } },
      _count: { select: { users: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    dataScope: row.dataScope,
    permissionCodes: row.permissions.map(({ code }) => code),
    userCount: row._count.users,
    updatedAt: row.updatedAt.toISOString(),
    lockReason: roleLockReason(row.code, row.users.length > 0),
    canDelete: !isPresetRole(row.code) && row._count.users === 0,
  }));
}
