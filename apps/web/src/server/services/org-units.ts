import 'server-only';
import { Prisma } from '@prisma/client';
import { auditChanges, type AuditChanges } from '@seedgw/contracts/audit';
import { MAX_ORG_DEPTH, checkOrgUnitMove, orgDepth } from '@seedgw/contracts/org-tree';
import { ROUTE_KIND_LABEL } from '@seedgw/contracts/route-plans';
import type {
  AssignOrgUnitManagerInput,
  CreateOrgUnitInput,
  MoveOrgUnitInput,
  UpdateOrgUnitInput,
} from '@seedgw/contracts/org-units';
import { db } from '@seedgw/db/client';
import { getAssignableOrgUnitIds, getScopedDb } from '@/server/auth/scoped-db';
import { DomainError } from '@/server/services/domain-error';

export type OrgUnitOutcome = { id: string; label: string; changes: AuditChanges };

type Tx = Prisma.TransactionClient;

const ORG_TREE_LOCK_KEY = 72026001;
const DUPLICATE_CODE_ERROR = new DomainError('CONFLICT', 'Mã đơn vị đã tồn tại', {
  code: 'Mã đơn vị đã tồn tại',
});

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

// Moi thay doi cay chay tuan tu de hai thao tac dong thoi khong tao ra vong lap.
async function withLockedTree<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
  try {
    return await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ORG_TREE_LOCK_KEY})`;
      return work(tx);
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw DUPLICATE_CODE_ERROR;
    throw error;
  }
}

function loadUnits(tx: Tx) {
  return tx.orgUnit.findMany({ select: { id: true, parentId: true, code: true, name: true } });
}

const UNIT_LEADER_ROLE = 'unit-leader';
const YES_NO = (value: boolean) => (value ? 'Có' : 'Không');

/**
 * Quyết định 31: Trưởng đơn vị là Lãnh đạo đơn vị, người duyệt cuối Tuyến và Chỉ tiêu. Chọn ai làm
 * Trưởng đơn vị thì tự gán thêm vai trò này; thôi làm thì không tự gỡ, Quản trị gỡ tay. Trả tên vai trò
 * khi vừa gán để ghi vào nhật ký.
 */
async function grantUnitLeaderRole(tx: Tx, userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const role = await tx.role.findUnique({
    where: { code: UNIT_LEADER_ROLE },
    select: { id: true, name: true },
  });
  if (!role) return null;
  const existing = await tx.userRole.findUnique({
    where: { userId_roleId: { userId, roleId: role.id } },
    select: { userId: true },
  });
  if (existing) return null;
  await tx.userRole.create({ data: { userId, roleId: role.id } });
  return role.name;
}

async function resolveManagerName(tx: Tx, managerId: string | null): Promise<string | null> {
  if (!managerId) return null;
  const manager = await tx.user.findFirst({
    where: { id: managerId, isActive: true },
    select: { fullName: true },
  });
  if (!manager) {
    throw new DomainError('VALIDATION', 'Trưởng đơn vị không hợp lệ', {
      managerId: 'Không tìm thấy nhân viên đang hoạt động này',
    });
  }
  return manager.fullName;
}

export function createOrgUnit(input: CreateOrgUnitInput): Promise<OrgUnitOutcome> {
  return withLockedTree(async (tx) => {
    const units = await loadUnits(tx);
    const parent = units.find((unit) => unit.id === input.parentId);
    if (!parent) throw new DomainError('NOT_FOUND', 'Không tìm thấy đơn vị cha');
    if (orgDepth(units, parent.id) >= MAX_ORG_DEPTH) {
      throw new DomainError('CONFLICT', `Cơ cấu tổ chức chỉ có tối đa ${MAX_ORG_DEPTH} cấp`);
    }

    const managerName = await resolveManagerName(tx, input.managerId);
    const created = await tx.orgUnit.create({ data: input, select: { id: true } });
    const grantedRole = await grantUnitLeaderRole(tx, input.managerId);

    return {
      id: created.id,
      label: input.code,
      changes: auditChanges(
        {},
        {
          code: input.code,
          name: input.name,
          parent: parent.name,
          manager: managerName,
          'Có cấp Quản lý': YES_NO(input.hasManagerLevel),
          routeKind: ROUTE_KIND_LABEL[input.routeKind],
          ...(grantedRole ? { 'Vai trò Trưởng đơn vị': `Gán ${grantedRole}` } : {}),
        },
      ),
    };
  });
}

export function updateOrgUnit(input: UpdateOrgUnitInput): Promise<OrgUnitOutcome> {
  return withLockedTree(async (tx) => {
    const current = await tx.orgUnit.findUnique({
      where: { id: input.id },
      select: {
        code: true,
        name: true,
        hasManagerLevel: true,
        routeKind: true,
        manager: { select: { fullName: true } },
      },
    });
    if (!current) throw new DomainError('NOT_FOUND', 'Không tìm thấy đơn vị này');

    const managerName = await resolveManagerName(tx, input.managerId);
    const changes = auditChanges(
      {
        code: current.code,
        name: current.name,
        manager: current.manager?.fullName ?? null,
        'Có cấp Quản lý': YES_NO(current.hasManagerLevel),
        routeKind: ROUTE_KIND_LABEL[current.routeKind],
      },
      {
        code: input.code,
        name: input.name,
        manager: managerName,
        'Có cấp Quản lý': YES_NO(input.hasManagerLevel),
        routeKind: ROUTE_KIND_LABEL[input.routeKind],
      },
    );

    if (Object.keys(changes).length > 0) {
      await tx.orgUnit.update({
        where: { id: input.id },
        data: {
          code: input.code,
          name: input.name,
          managerId: input.managerId,
          hasManagerLevel: input.hasManagerLevel,
          routeKind: input.routeKind,
        },
      });
    }
    const grantedRole = await grantUnitLeaderRole(tx, input.managerId);
    if (grantedRole)
      changes['Vai trò Trưởng đơn vị'] = { before: null, after: `Gán ${grantedRole}` };
    return { id: input.id, label: input.code, changes };
  });
}

// Quan tri don vi chi doi duoc Truong don vi trong pham vi cua minh va chi chon nguoi trong pham vi.
export async function assignOrgUnitManager({
  id,
  managerId,
  routeKind,
}: AssignOrgUnitManagerInput): Promise<OrgUnitOutcome> {
  const [assignableUnits, scoped, unit] = await Promise.all([
    getAssignableOrgUnitIds(),
    getScopedDb(),
    db.orgUnit.findUnique({
      where: { id },
      select: {
        code: true,
        managerId: true,
        routeKind: true,
        manager: { select: { fullName: true } },
      },
    }),
  ]);
  if (!unit) throw new DomainError('NOT_FOUND', 'Không tìm thấy đơn vị này');
  if (assignableUnits && !assignableUnits.has(id)) {
    throw new DomainError('FORBIDDEN', 'Đơn vị này nằm ngoài phạm vi của bạn');
  }
  if (managerId === unit.managerId && routeKind === unit.routeKind) {
    return { id, label: unit.code, changes: {} };
  }

  const manager = managerId
    ? await scoped.user.findFirst({
        where: { id: managerId, isActive: true },
        select: { fullName: true },
      })
    : null;
  if (managerId && !manager) {
    throw new DomainError('VALIDATION', 'Trưởng đơn vị không hợp lệ', {
      managerId: 'Người này không tồn tại, đã bị khoá hoặc ngoài phạm vi của bạn',
    });
  }

  const grantedRole = await db.$transaction(async (tx) => {
    await tx.orgUnit.update({ where: { id }, data: { managerId, routeKind } });
    return managerId === unit.managerId ? null : grantUnitLeaderRole(tx, managerId);
  });
  return {
    id,
    label: unit.code,
    changes: auditChanges(
      { manager: unit.manager?.fullName ?? null, routeKind: ROUTE_KIND_LABEL[unit.routeKind] },
      {
        manager:
          managerId === unit.managerId
            ? (unit.manager?.fullName ?? null)
            : (manager?.fullName ?? null),
        routeKind: ROUTE_KIND_LABEL[routeKind],
        ...(grantedRole ? { 'Vai trò Trưởng đơn vị': `Gán ${grantedRole}` } : {}),
      },
    ),
  };
}

export function moveOrgUnit({ id, newParentId }: MoveOrgUnitInput): Promise<OrgUnitOutcome> {
  return withLockedTree(async (tx) => {
    const units = await loadUnits(tx);
    const check = checkOrgUnitMove(units, id, newParentId);
    if (!check.ok) throw new DomainError('CONFLICT', check.reason);

    const unit = units.find((item) => item.id === id);
    const oldParent = units.find((item) => item.id === unit?.parentId);
    const newParent = units.find((item) => item.id === newParentId);
    await tx.orgUnit.update({ where: { id }, data: { parentId: newParentId } });

    return {
      id,
      label: unit?.code ?? id,
      changes: auditChanges(
        { parent: oldParent?.name ?? null },
        { parent: newParent?.name ?? null },
      ),
    };
  });
}

export function deleteOrgUnit(id: string): Promise<OrgUnitOutcome> {
  return withLockedTree(async (tx) => {
    const unit = await tx.orgUnit.findUnique({
      where: { id },
      select: {
        code: true,
        name: true,
        parentId: true,
        _count: { select: { users: true, children: true, dealers: true } },
      },
    });
    if (!unit) throw new DomainError('NOT_FOUND', 'Không tìm thấy đơn vị này');
    if (unit.parentId === null) throw new DomainError('CONFLICT', 'Không thể xoá đơn vị gốc');
    if (unit._count.dealers > 0) {
      throw new DomainError(
        'CONFLICT',
        `Đơn vị còn ${unit._count.dealers} đại lý, dùng nút Đổi đơn vị ở danh sách đại lý để chuyển trước khi xoá`,
      );
    }
    if (unit._count.users > 0) {
      throw new DomainError(
        'CONFLICT',
        `Đơn vị còn ${unit._count.users} nhân viên, cần chuyển nhân viên sang đơn vị khác trước khi xoá`,
      );
    }
    if (unit._count.children > 0) {
      throw new DomainError('CONFLICT', 'Đơn vị còn đơn vị cấp dưới, cần xử lý cấp dưới trước');
    }

    await tx.orgUnit.delete({ where: { id } });
    return {
      id,
      label: unit.code,
      changes: auditChanges({ code: unit.code, name: unit.name }, {}),
    };
  });
}
