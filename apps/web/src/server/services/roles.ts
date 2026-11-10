import 'server-only';
import type { Prisma } from '@prisma/client';
import { PERMISSIONS, roleExceedsActor, type DataScope } from '@dms/contracts/access';
import { auditChanges, type AuditChanges } from '@dms/contracts/audit';
import {
  DATA_SCOPE_LABEL,
  diffPermissionCodes,
  isPermissionReserved,
  isPresetRole,
  roleLockReason,
  type CreateRoleInput,
  type SaveRoleMatrixInput,
} from '@dms/contracts/roles';
import { db } from '@dms/db/client';
import type { CurrentUser } from '@/server/auth/current-user';
import { DomainError } from '@/server/services/domain-error';
import { isUniqueViolation } from '@/server/services/users';

export type RoleOutcome = { id: string; label: string; changes: AuditChanges };

type RoleInput = SaveRoleMatrixInput['roles'][number];

const PERMISSION_NAME = new Map<string, string>(
  PERMISSIONS.map(({ code, name }) => [code, name] as const),
);

export const ROLE_MATRIX_SELECT = {
  id: true,
  code: true,
  name: true,
  dataScope: true,
  updatedAt: true,
  permissions: { select: { code: true } },
} satisfies Prisma.RoleSelect;

function namesOf(codes: readonly string[]): string | null {
  return codes.length === 0
    ? null
    : codes.map((code) => PERMISSION_NAME.get(code) ?? code).join(', ');
}

type CurrentRole = Prisma.RoleGetPayload<{ select: typeof ROLE_MATRIX_SELECT }> & {
  users: { userId: string }[];
};

function asAuthority(scope: DataScope, codes: readonly string[]) {
  return { dataScope: scope, permissions: codes.map((code) => ({ code })) };
}

function assertRoleEditable(actor: CurrentUser, current: CurrentRole, next: RoleInput): void {
  const lockReason = roleLockReason(current.code, current.users.length > 0);
  if (lockReason) throw new DomainError('CONFLICT', `${current.name}: ${lockReason}`);

  const before = current.permissions.map(({ code }) => code);
  const { added } = diffPermissionCodes(before, next.permissionCodes);
  if (added.some(isPermissionReserved)) {
    throw new DomainError('FORBIDDEN', 'Quyền này chỉ dành cho vai trò Quản trị hệ thống');
  }
  if (
    roleExceedsActor(actor, asAuthority(current.dataScope, before)) ||
    roleExceedsActor(actor, asAuthority(next.dataScope, next.permissionCodes))
  ) {
    throw new DomainError('FORBIDDEN', `Bạn không được sửa ${current.name} vượt quyền của mình`);
  }
}

export async function saveRoleMatrix(
  actor: CurrentUser,
  input: SaveRoleMatrixInput,
): Promise<RoleOutcome[]> {
  const currentRoles = await db.role.findMany({
    where: { id: { in: input.roles.map((role) => role.id) } },
    select: {
      ...ROLE_MATRIX_SELECT,
      users: { where: { userId: actor.id }, select: { userId: true } },
    },
  });
  const currentById = new Map(currentRoles.map((role) => [role.id, role]));

  const planned = input.roles.flatMap((next) => {
    const current = currentById.get(next.id);
    if (!current) throw new DomainError('CONFLICT', 'Có vai trò đã bị xoá, vui lòng tải lại trang');
    assertRoleEditable(actor, current, next);

    const { added, removed } = diffPermissionCodes(
      current.permissions.map(({ code }) => code),
      next.permissionCodes,
    );
    const changes = auditChanges(
      { dataScope: DATA_SCOPE_LABEL[current.dataScope] },
      {
        dataScope: DATA_SCOPE_LABEL[next.dataScope],
        permissionsAdded: namesOf(added),
        permissionsRemoved: namesOf(removed),
      },
    );
    return Object.keys(changes).length === 0
      ? []
      : [{ next, name: current.name, code: current.code, changes }];
  });

  await db.$transaction(async (tx) => {
    for (const { next, name } of planned) {
      // So thoi diem cap nhat de hai nguoi cung sua khong ghi de len nhau.
      const { count } = await tx.role.updateMany({
        where: { id: next.id, updatedAt: new Date(next.expectedUpdatedAt) },
        data: { dataScope: next.dataScope, updatedAt: new Date() },
      });
      if (count === 0) {
        throw new DomainError(
          'CONFLICT',
          `${name} vừa được người khác sửa, vui lòng tải lại trang`,
        );
      }
      await tx.role.update({
        where: { id: next.id },
        data: { permissions: { set: next.permissionCodes.map((code) => ({ code })) } },
      });
    }
  });

  return planned.map(({ next, code, changes }) => ({ id: next.id, label: code, changes }));
}

export async function createRole(input: CreateRoleInput): Promise<RoleOutcome> {
  try {
    const created = await db.role.create({ data: input, select: { id: true } });
    return {
      id: created.id,
      label: input.code,
      changes: auditChanges(
        {},
        { code: input.code, name: input.name, dataScope: DATA_SCOPE_LABEL[input.dataScope] },
      ),
    };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new DomainError('CONFLICT', 'Mã vai trò đã tồn tại', {
        code: 'Mã vai trò đã tồn tại',
      });
    }
    throw error;
  }
}

export async function deleteRole(id: string): Promise<RoleOutcome> {
  const role = await db.role.findUnique({
    where: { id },
    select: {
      code: true,
      name: true,
      dataScope: true,
      _count: { select: { approvalSteps: true } },
    },
  });
  if (!role) throw new DomainError('NOT_FOUND', 'Không tìm thấy vai trò này');
  if (isPresetRole(role.code)) throw new DomainError('CONFLICT', 'Không thể xoá vai trò mặc định');
  if (role._count.approvalSteps > 0) {
    throw new DomainError(
      'CONFLICT',
      'Vai trò đã được dùng trong quy trình duyệt nên không xoá được',
    );
  }

  // Dieu kien nam trong cau lenh de khong xoa nham khi vua co nguoi duoc gan vai tro.
  const { count } = await db.role.deleteMany({ where: { id, users: { none: {} } } });
  if (count === 0) {
    throw new DomainError('CONFLICT', 'Vai trò còn người dùng, cần gỡ vai trò khỏi họ trước');
  }
  return {
    id,
    label: role.code,
    changes: auditChanges(
      { code: role.code, name: role.name, dataScope: DATA_SCOPE_LABEL[role.dataScope] },
      {},
    ),
  };
}
