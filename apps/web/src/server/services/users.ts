import 'server-only';
import { Prisma } from '@prisma/client';
import { verify } from 'argon2';
import { roleExceedsActor } from '@seedgw/contracts/access';
import { auditChanges, type AuditChanges } from '@seedgw/contracts/audit';
import type { ChangePasswordInput } from '@seedgw/contracts/auth';
import { formatDateOnly } from '@seedgw/contracts/format';
import {
  PASSWORD_HAS_EMPLOYEE_CODE,
  passwordHasEmployeeCode,
  type CreatedUser,
  type CreateUserInput,
  type SetUserPasswordInput,
  type UpdateUserInput,
  type UserAllowedActions,
} from '@seedgw/contracts/users';
import { db } from '@seedgw/db/client';
import type { CurrentUser } from '@/server/auth/current-user';
import { getAssignableOrgUnitIds, getScopedDb } from '@/server/auth/scoped-db';
import { CLEAR_LOGIN_FAILURES, hashPassword } from '@/server/services/credentials';
import { DomainError } from '@/server/services/domain-error';

const MANAGER_TREE_LOCK_KEY = 73_420_02;
const MANAGER_CHAIN_MAX_DEPTH = 1000;
const IMPERSONATE_PERMISSION = 'admin.user.impersonate';

export const ROLE_PERMISSIONS_SELECT = {
  id: true,
  name: true,
  dataScope: true,
  permissions: { select: { code: true } },
} satisfies Prisma.RoleSelect;

export const USER_ROLES_SELECT = {
  select: { role: { select: ROLE_PERMISSIONS_SELECT } },
} satisfies Prisma.User$rolesArgs;

type RoleWithPermissions = Prisma.RoleGetPayload<{ select: typeof ROLE_PERMISSIONS_SELECT }>;
type UserRoleRow = { role: RoleWithPermissions };

export function exceedsActor(actor: CurrentUser, roles: readonly RoleWithPermissions[]): boolean {
  return roles.some((role) => roleExceedsActor(actor, role));
}

// Khong cho thao tac tren tai khoan co quyen cao hon, neu khong co the dat lai mat khau
// cua nguoi do roi dang nhap de leo quyen.
function assertWithinActor(actor: CurrentUser, roles: readonly UserRoleRow[]): void {
  if (
    exceedsActor(
      actor,
      roles.map(({ role }) => role),
    )
  ) {
    throw new DomainError('FORBIDDEN', 'Tài khoản này có quyền cao hơn quyền của bạn');
  }
}

export function allowedActionsFor(
  actor: CurrentUser,
  target: { id: string; isActive: boolean; roles: readonly UserRoleRow[] },
): UserAllowedActions {
  const roles = target.roles.map(({ role }) => role);
  const isSelf = target.id === actor.id;
  const edit = !exceedsActor(actor, roles);
  const targetCanImpersonate = roles.some((role) =>
    role.permissions.some(({ code }) => code === IMPERSONATE_PERMISSION),
  );

  return {
    edit,
    lock: edit && !isSelf,
    resetPassword: edit && !isSelf,
    impersonate:
      edit &&
      !isSelf &&
      target.isActive &&
      !targetCanImpersonate &&
      !actor.impersonator &&
      actor.permissions.has(IMPERSONATE_PERMISSION),
  };
}

function emptyToNull(value: string): string | null {
  return value === '' ? null : value;
}

export function dateFromInput(value: string): Date | null {
  return value === '' ? null : new Date(`${value}T00:00:00.000Z`);
}

export function dateToInput(value: Date | null): string {
  return value ? value.toISOString().slice(0, 10) : '';
}

function managerLabel(manager: { employeeCode: string; fullName: string } | null): string | null {
  return manager ? `${manager.employeeCode} - ${manager.fullName}` : null;
}

export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

type AssignmentInput = Pick<CreateUserInput, 'orgUnitId' | 'managerId' | 'roleIds'>;

async function resolveAssignment(
  actor: CurrentUser,
  input: AssignmentInput,
  currentManagerId: string | null,
) {
  const scoped = await getScopedDb();
  const [orgUnit, roles, assignableUnits, manager] = await Promise.all([
    db.orgUnit.findUnique({ where: { id: input.orgUnitId }, select: { id: true, name: true } }),
    db.role.findMany({
      where: { id: { in: input.roleIds } },
      select: ROLE_PERMISSIONS_SELECT,
      orderBy: { name: 'asc' },
    }),
    getAssignableOrgUnitIds(),
    input.managerId
      ? scoped.user.findUnique({
          where: { id: input.managerId },
          select: { id: true, employeeCode: true, fullName: true, isActive: true },
        })
      : null,
  ]);

  if (!orgUnit || (assignableUnits && !assignableUnits.has(orgUnit.id))) {
    throw new DomainError('VALIDATION', 'Đơn vị không hợp lệ', {
      orgUnitId: 'Đơn vị không tồn tại hoặc ngoài phạm vi của bạn',
    });
  }
  if (roles.length !== new Set(input.roleIds).size) {
    throw new DomainError('VALIDATION', 'Vai trò không hợp lệ', {
      roleIds: 'Có vai trò không còn tồn tại, vui lòng tải lại trang',
    });
  }
  if (exceedsActor(actor, roles)) {
    throw new DomainError(
      'FORBIDDEN',
      'Bạn không được gán vai trò có quyền cao hơn quyền của mình',
      {
        roleIds: 'Bạn không được gán vai trò có quyền cao hơn quyền của mình',
      },
    );
  }
  if (input.managerId) {
    const isKept = input.managerId === currentManagerId;
    if (!manager || (!manager.isActive && !isKept)) {
      throw new DomainError('VALIDATION', 'Quản lý trực tiếp không hợp lệ', {
        managerId: 'Người này không tồn tại hoặc đã bị khoá',
      });
    }
  }
  return { orgUnit, roles, manager };
}

function roleNames(roles: readonly { name: string }[]): string {
  return roles
    .map((role) => role.name)
    .sort((a, b) => a.localeCompare(b, 'vi'))
    .join(', ');
}

function profileData(input: Pick<CreateUserInput, keyof CreateUserInput & keyof UpdateUserInput>) {
  return {
    fullName: input.fullName,
    phone: emptyToNull(input.phone),
    email: emptyToNull(input.email),
    jobTitle: emptyToNull(input.jobTitle),
    hiredAt: dateFromInput(input.hiredAt),
    orgUnitId: input.orgUnitId,
    managerId: input.managerId,
  };
}

type CreateUserOutcome = CreatedUser & { changes: AuditChanges };

export async function createUser(
  actor: CurrentUser,
  input: CreateUserInput,
): Promise<CreateUserOutcome> {
  const { orgUnit, roles, manager } = await resolveAssignment(actor, input, null);
  const passwordHash = await hashPassword(input.password);

  try {
    const created = await db.user.create({
      data: {
        ...profileData(input),
        employeeCode: input.employeeCode,
        passwordHash,
        mustChangePassword: input.mustChangePassword,
        roles: { create: input.roleIds.map((roleId) => ({ roleId })) },
      },
      select: { id: true },
    });

    return {
      id: created.id,
      employeeCode: input.employeeCode,
      changes: auditChanges(
        {},
        {
          fullName: input.fullName,
          phone: emptyToNull(input.phone),
          email: emptyToNull(input.email),
          jobTitle: emptyToNull(input.jobTitle),
          hiredAt: formatDateOnly(input.hiredAt),
          orgUnit: orgUnit.name,
          directManager: managerLabel(manager),
          roles: roleNames(roles),
          mustChangePassword: input.mustChangePassword ? 'Có' : 'Không',
        },
      ),
    };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new DomainError('CONFLICT', 'Mã nhân viên đã tồn tại', {
        employeeCode: 'Mã nhân viên đã tồn tại',
      });
    }
    throw error;
  }
}

type Tx = Prisma.TransactionClient;

async function assertNoManagerCycle(tx: Tx, userId: string, managerId: string): Promise<void> {
  const rows = await tx.$queryRaw<unknown[]>`
    WITH RECURSIVE chain (id, manager_id, depth) AS (
      SELECT id, manager_id, 1 FROM users WHERE id = ${managerId}::uuid
      UNION ALL
      SELECT u.id, u.manager_id, c.depth + 1
      FROM users u JOIN chain c ON u.id = c.manager_id
      WHERE c.depth < ${MANAGER_CHAIN_MAX_DEPTH}
    )
    SELECT 1 FROM chain WHERE id = ${userId}::uuid LIMIT 1
  `;
  if (rows.length > 0) {
    throw new DomainError('CONFLICT', 'Quản lý trực tiếp tạo thành vòng lặp', {
      managerId: 'Người này đang là cấp dưới của tài khoản đang sửa',
    });
  }
}

type UpdateUserOutcome = { employeeCode: string; changes: AuditChanges };

export async function updateUser(
  actor: CurrentUser,
  input: UpdateUserInput,
): Promise<UpdateUserOutcome | null> {
  const scoped = await getScopedDb();
  const current = await scoped.user.findUnique({
    where: { id: input.id },
    select: {
      employeeCode: true,
      fullName: true,
      phone: true,
      email: true,
      jobTitle: true,
      hiredAt: true,
      managerId: true,
      orgUnit: { select: { name: true } },
      manager: { select: { employeeCode: true, fullName: true } },
      roles: USER_ROLES_SELECT,
    },
  });
  if (!current) return null;
  assertWithinActor(actor, current.roles);

  if (input.managerId === input.id) {
    throw new DomainError('VALIDATION', 'Quản lý trực tiếp không hợp lệ', {
      managerId: 'Một người không thể tự quản lý chính mình',
    });
  }

  const { orgUnit, roles, manager } = await resolveAssignment(actor, input, current.managerId);
  const currentRoles = current.roles.map(({ role }) => role);
  const nextRoleIds = new Set(input.roleIds);
  const rolesChanged =
    currentRoles.length !== nextRoleIds.size ||
    currentRoles.some((role) => !nextRoleIds.has(role.id));

  // Dam bao luon con it nhat mot quan tri vien va khong tu nang quyen.
  if (rolesChanged && input.id === actor.id) {
    throw new DomainError('CONFLICT', 'Không thể tự đổi vai trò của chính mình', {
      roleIds: 'Không thể tự đổi vai trò của chính mình',
    });
  }

  const changes = auditChanges(
    {
      fullName: current.fullName,
      phone: current.phone,
      email: current.email,
      jobTitle: current.jobTitle,
      hiredAt: formatDateOnly(dateToInput(current.hiredAt)),
      orgUnit: current.orgUnit?.name ?? null,
      directManager: managerLabel(current.manager),
      roles: roleNames(currentRoles),
    },
    {
      fullName: input.fullName,
      phone: emptyToNull(input.phone),
      email: emptyToNull(input.email),
      jobTitle: emptyToNull(input.jobTitle),
      hiredAt: formatDateOnly(input.hiredAt),
      orgUnit: orgUnit.name,
      directManager: managerLabel(manager),
      roles: roleNames(roles),
    },
  );

  if (Object.keys(changes).length > 0) {
    await db.$transaction(async (tx) => {
      if (input.managerId && input.managerId !== current.managerId) {
        // Chay tuan tu de hai lan doi dong thoi khong tao ra vong quan ly.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${MANAGER_TREE_LOCK_KEY})`;
        await assertNoManagerCycle(tx, input.id, input.managerId);
      }
      await tx.user.update({ where: { id: input.id }, data: profileData(input) });
      if (rolesChanged) {
        await tx.userRole.deleteMany({ where: { userId: input.id } });
        await tx.userRole.createMany({
          data: input.roleIds.map((roleId) => ({ userId: input.id, roleId })),
        });
      }
    });
  }
  return { employeeCode: current.employeeCode, changes };
}

type SetUsersActiveOutcome = {
  changed: Array<{ id: string; employeeCode: string }>;
  skipped: number;
};

export async function setUsersActive(
  actor: CurrentUser,
  ids: readonly string[],
  isActive: boolean,
): Promise<SetUsersActiveOutcome> {
  const scoped = await getScopedDb();
  const rows = await scoped.user.findMany({
    where: { id: { in: [...ids] }, isActive: !isActive },
    select: { id: true, employeeCode: true, roles: USER_ROLES_SELECT },
  });
  const changed = rows
    .filter(
      (row) =>
        row.id !== actor.id &&
        !exceedsActor(
          actor,
          row.roles.map(({ role }) => role),
        ),
    )
    .map(({ id, employeeCode }) => ({ id, employeeCode }));
  const changedIds = changed.map((row) => row.id);

  if (changedIds.length > 0) {
    await (isActive
      ? db.user.updateMany({
          where: { id: { in: changedIds } },
          data: { isActive: true, ...CLEAR_LOGIN_FAILURES },
        })
      : // Tang phien ban va thu hoi thiet bi cung luc de dien thoai bi dang xuat o lan goi tiep theo.
        db.$transaction([
          db.user.updateMany({
            where: { id: { in: changedIds } },
            data: { isActive: false, sessionVersion: { increment: 1 } },
          }),
          db.mobileDevice.updateMany({
            where: { userId: { in: changedIds }, status: { not: 'REVOKED' } },
            data: { status: 'REVOKED', revokedAt: new Date() },
          }),
        ]));
  }
  return { changed, skipped: ids.length - changed.length };
}

type SetPasswordOutcome = { employeeCode: string };

export async function setUserPassword(
  actor: CurrentUser,
  input: SetUserPasswordInput,
): Promise<SetPasswordOutcome | null> {
  const { id } = input;
  if (id === actor.id) {
    throw new DomainError('CONFLICT', 'Vui lòng dùng trang Đổi mật khẩu cho tài khoản của mình');
  }

  const scoped = await getScopedDb();
  const target = await scoped.user.findUnique({
    where: { id },
    select: { employeeCode: true, roles: USER_ROLES_SELECT },
  });
  if (!target) return null;
  assertWithinActor(actor, target.roles);
  if (passwordHasEmployeeCode(input.password, target.employeeCode)) {
    throw new DomainError('VALIDATION', PASSWORD_HAS_EMPLOYEE_CODE, {
      password: PASSWORD_HAS_EMPLOYEE_CODE,
    });
  }

  const passwordHash = await hashPassword(input.password);
  await db.user.update({
    where: { id },
    data: {
      passwordHash,
      mustChangePassword: input.mustChangePassword,
      sessionVersion: { increment: 1 },
      ...CLEAR_LOGIN_FAILURES,
    },
  });
  return { employeeCode: target.employeeCode };
}

export async function changeOwnPassword(
  user: CurrentUser,
  input: ChangePasswordInput,
): Promise<void> {
  const record = await db.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!(await verify(record.passwordHash, input.currentPassword))) {
    throw new DomainError('VALIDATION', 'Mật khẩu hiện tại không đúng', {
      currentPassword: 'Mật khẩu hiện tại không đúng',
    });
  }
  if (input.newPassword.toUpperCase().includes(user.employeeCode)) {
    throw new DomainError('VALIDATION', PASSWORD_HAS_EMPLOYEE_CODE, {
      newPassword: 'Mật khẩu không được chứa mã nhân viên',
    });
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(input.newPassword),
      mustChangePassword: false,
      sessionVersion: { increment: 1 },
      ...CLEAR_LOGIN_FAILURES,
    },
  });
}

type SetDeviceOutcome = {
  userId: string;
  employeeCode: string;
  deviceName: string;
  previousStatus: string;
};

// Moi nhan vien chi co mot thiet bi dang dung, duyet thiet bi moi se thu hoi thiet bi cu.
export async function setMobileDeviceStatus(
  actor: CurrentUser,
  deviceId: string,
  status: 'ACTIVE' | 'REVOKED',
): Promise<SetDeviceOutcome | null> {
  const scoped = await getScopedDb();
  const device = await scoped.mobileDevice.findUnique({
    where: { id: deviceId },
    select: {
      name: true,
      status: true,
      userId: true,
      user: { select: { employeeCode: true, isActive: true, roles: USER_ROLES_SELECT } },
    },
  });
  if (!device) return null;
  assertWithinActor(actor, device.user.roles);

  if (status === 'ACTIVE' && (device.status !== 'PENDING' || !device.user.isActive)) {
    throw new DomainError('CONFLICT', 'Chỉ duyệt được thiết bị đang chờ của tài khoản hoạt động');
  }
  if (status === 'REVOKED' && device.status === 'REVOKED') {
    throw new DomainError('CONFLICT', 'Thiết bị này đã được thu hồi');
  }

  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM users WHERE id = ${device.userId}::uuid FOR UPDATE`;
    if (status === 'ACTIVE') {
      await tx.mobileDevice.updateMany({
        where: { userId: device.userId, status: 'ACTIVE' },
        data: { status: 'REVOKED', revokedAt: now },
      });
    }
    await tx.mobileDevice.update({
      where: { id: deviceId },
      data: status === 'ACTIVE' ? { status, approvedAt: now } : { status, revokedAt: now },
    });
  });

  return {
    userId: device.userId,
    employeeCode: device.user.employeeCode,
    deviceName: device.name,
    previousStatus: device.status,
  };
}
