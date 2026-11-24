import 'server-only';
import type { Prisma } from '@prisma/client';
import { auditChanges, type AuditChanges } from '@seedgw/contracts/audit';
import {
  DEALER_LEVEL_LABEL,
  DEALER_STATUS_LABEL,
  type BulkAssignDealersInput,
  type BulkMoveDealersInput,
  type DealerFilter,
  type DealerLevel,
  type UpdateDealerInput,
  type VisitCutoffs,
  visitCutoffs,
} from '@seedgw/contracts/dealers';
import { escapeLikePattern, normalizeSearchText } from '@seedgw/contracts/text';
import { db } from '@seedgw/db/client';
import { getOrgUnitAncestorIds, getOrgUnitTreeIds } from '@seedgw/db/org-units';
import type { CurrentUser } from '@/server/auth/current-user';
import { getAssignableOrgUnitIds, getScopedDb } from '@/server/auth/scoped-db';
import { DomainError } from './domain-error';
import { listProvinceRegions, readUnitAreas } from './regions';
import { readSystemSettings } from './settings';

/** Mốc quá hạn chưa ghé lại theo cấp đại lý, đọc từ Tham số (K0). */
export async function loadVisitCutoffs(now = new Date()): Promise<VisitCutoffs> {
  const { values } = await readSystemSettings();
  return visitCutoffs(
    {
      level1: values.dealerUnvisitedDaysLevel1,
      level2: values.dealerUnvisitedDaysLevel2,
      level3: values.dealerUnvisitedDaysLevel3,
    },
    now,
  );
}

function visitWhere(visit: DealerFilter['visit'], cutoffs: VisitCutoffs): Prisma.DealerWhereInput {
  if (visit === 'NEVER') return { lastVisitedAt: null };
  if (visit === 'OVERDUE') {
    return {
      OR: ([1, 2, 3] as const).map((level) => ({
        level,
        lastVisitedAt: { lt: cutoffs[level] },
      })),
    };
  }
  return {};
}

export function dealerWhere(filter: DealerFilter, cutoffs: VisitCutoffs): Prisma.DealerWhereInput {
  const search = filter.q ? normalizeSearchText(filter.q) : '';
  return {
    ...visitWhere(filter.visit, cutoffs),
    ...(search ? { searchText: { contains: escapeLikePattern(search) } } : {}),
    ...(filter.level ? { level: filter.level } : {}),
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.orgUnitId ? { orgUnitId: filter.orgUnitId } : {}),
    ...(filter.unassignedOnly ? { assignedUserId: null } : {}),
    ...(filter.missingLocationOnly ? { lat: null } : {}),
  };
}

/** K7b: lọc vùng, tỉnh và đại lý ngoài địa bàn (cần đọc danh mục nên tách khỏi dealerWhere). */
async function dealerAreaWhere(filter: DealerFilter): Promise<Prisma.DealerWhereInput[]> {
  const parts: Prisma.DealerWhereInput[] = [];
  if (filter.province === 'NONE') parts.push({ provinceName: null });
  else if (filter.province) parts.push({ provinceName: filter.province });
  if (filter.regionId) {
    const provinces = (await listProvinceRegions())
      .filter((row) => row.regionId === filter.regionId)
      .map((row) => row.name);
    parts.push({ provinceName: { in: provinces } });
  }
  if (filter.outsideArea) {
    const areas = await readUnitAreas();
    parts.push({
      OR: [...areas].map(([orgUnitId, provinces]) => ({
        orgUnitId,
        provinceName: { notIn: provinces, not: null },
      })),
    });
  }
  return parts;
}

/** Điều kiện đầy đủ của bộ lọc danh sách đại lý, dùng cho danh sách, xuất Excel và thao tác hàng loạt. */
export async function buildDealerWhere(filter: DealerFilter): Promise<Prisma.DealerWhereInput> {
  const [cutoffs, area] = await Promise.all([loadVisitCutoffs(), dealerAreaWhere(filter)]);
  const base = dealerWhere(filter, cutoffs);
  return area.length > 0 ? { AND: [base, ...area] } : base;
}

const ASSIGNEE_OUTSIDE_UNIT =
  'Nhân viên này không thuộc đơn vị phụ trách đại lý, chọn nhân viên khác hoặc để Chờ gán';

/**
 * Nhân viên được gán phải nằm trong phạm vi của người gán, và (K7b) thuộc đơn vị phụ trách đại lý hoặc đơn vị
 * con của nó. Trả tên và chuỗi đơn vị của nhân viên (đơn vị của người đó và các đơn vị cha).
 */
async function assertAssignableUser(
  userId: string | null,
  orgUnitId: string | null,
): Promise<{ name: string; unitPath: string[] } | null> {
  if (!userId) return null;
  const scoped = await getScopedDb();
  const user = await scoped.user.findFirst({
    where: { id: userId, isActive: true },
    select: { fullName: true, orgUnitId: true },
  });
  if (!user) {
    throw new DomainError('VALIDATION', 'Nhân viên không hợp lệ', {
      assignedUserId: 'Chỉ chọn được nhân viên đang hoạt động trong phạm vi của bạn',
    });
  }
  const unitPath = user.orgUnitId ? await getOrgUnitAncestorIds(user.orgUnitId) : [];
  if (orgUnitId && !unitPath.includes(orgUnitId)) {
    throw new DomainError('VALIDATION', ASSIGNEE_OUTSIDE_UNIT, {
      assignedUserId: ASSIGNEE_OUTSIDE_UNIT,
    });
  }
  return { name: user.fullName, unitPath };
}

async function assertAssignableUnit(orgUnitId: string): Promise<string> {
  const [assignable, unit] = await Promise.all([
    getAssignableOrgUnitIds(),
    db.orgUnit.findUnique({ where: { id: orgUnitId }, select: { name: true } }),
  ]);
  if (!unit || (assignable && !assignable.has(orgUnitId))) {
    throw new DomainError('FORBIDDEN', 'Bạn không được chuyển đại lý sang đơn vị này');
  }
  return unit.name;
}

async function resolveParent(code: string | null, selfId: string) {
  if (!code) return null;
  const upper = code.toUpperCase();
  const parent = await db.dealer.findFirst({
    where: { OR: [{ code: upper }, { legacyCode: { equals: code, mode: 'insensitive' } }] },
    select: { id: true, name: true, level: true },
  });
  if (!parent) {
    throw new DomainError('VALIDATION', 'Không tìm thấy đại lý cấp trên', {
      parentCode: 'Không có đại lý mang mã này',
    });
  }
  if (parent.id === selfId) {
    throw new DomainError('VALIDATION', 'Đại lý không thể là cấp trên của chính mình', {
      parentCode: 'Nhập mã của đại lý khác',
    });
  }
  return parent;
}

type UpdateOutcome = { id: string; label: string; changes: AuditChanges };

export async function updateDealer(
  actor: CurrentUser,
  input: UpdateDealerInput,
): Promise<UpdateOutcome> {
  const scoped = await getScopedDb();
  const current = await scoped.dealer.findUnique({
    where: { id: input.id },
    select: {
      name: true,
      code: true,
      legacyCode: true,
      level: true,
      status: true,
      phone: true,
      ownerName: true,
      ownerPhone: true,
      address: true,
      provinceName: true,
      lat: true,
      lng: true,
      orgUnitId: true,
      orgUnit: { select: { name: true } },
      assignedUserId: true,
      assignedUser: { select: { fullName: true } },
      parent: { select: { name: true } },
    },
  });
  if (!current)
    throw new DomainError('NOT_FOUND', 'Không tìm thấy đại lý hoặc bạn không có quyền xem');

  const unitChanged = input.orgUnitId !== current.orgUnitId;
  const userChanged = input.assignedUserId !== current.assignedUserId;
  const [unitName, assignee, parent] = await Promise.all([
    unitChanged ? assertAssignableUnit(input.orgUnitId) : (current.orgUnit?.name ?? null),
    // Đổi đơn vị mà giữ nhân viên cũ cũng phải kiểm lại nhân viên có thuộc đơn vị mới không (K7b).
    userChanged || unitChanged
      ? assertAssignableUser(input.assignedUserId, input.orgUnitId)
      : Promise.resolve(null),
    resolveParent(input.parentCode, input.id),
  ]);
  const userName =
    userChanged || unitChanged
      ? (assignee?.name ?? null)
      : (current.assignedUser?.fullName ?? null);

  const locationText = (lat: number | null, lng: number | null) =>
    lat === null || lng === null ? null : `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  const changes = auditChanges(
    {
      level: DEALER_LEVEL_LABEL[current.level as DealerLevel],
      status: DEALER_STATUS_LABEL[current.status],
      parentDealer: current.parent?.name ?? null,
      phone: current.phone,
      ownerName: current.ownerName,
      ownerPhone: current.ownerPhone,
      address: current.address,
      province: current.provinceName,
      location: locationText(current.lat, current.lng),
      orgUnit: current.orgUnit?.name ?? null,
      assignedUser: current.assignedUser?.fullName ?? null,
    },
    {
      level: DEALER_LEVEL_LABEL[input.level],
      status: DEALER_STATUS_LABEL[input.status],
      parentDealer: parent?.name ?? null,
      phone: input.phone,
      ownerName: input.ownerName,
      ownerPhone: input.ownerPhone,
      address: input.address,
      province: input.provinceName,
      location: locationText(input.lat, input.lng),
      orgUnit: unitName,
      assignedUser: userName,
    },
  );

  if (Object.keys(changes).length > 0) {
    const locationChanged = input.lat !== current.lat || input.lng !== current.lng;
    await scoped.dealer.update({
      where: { id: input.id },
      data: {
        level: input.level,
        status: input.status,
        parentId: parent?.id ?? null,
        phone: input.phone,
        // Đã sửa số điện thoại thì bỏ số gốc sai định dạng.
        ...(input.phone !== current.phone ? { phoneRaw: null } : {}),
        ownerName: input.ownerName,
        ownerPhone: input.ownerPhone,
        address: input.address,
        provinceName: input.provinceName,
        lat: input.lat,
        lng: input.lng,
        ...(locationChanged ? { locatedAt: input.lat === null ? null : new Date() } : {}),
        orgUnitId: input.orgUnitId,
        assignedUserId: input.assignedUserId,
      },
    });
  }
  return {
    id: input.id,
    label: current.code ?? current.legacyCode ?? current.name,
    changes,
  };
}

async function targetWhere(input: {
  filter: DealerFilter;
  ids: string[];
}): Promise<Prisma.DealerWhereInput> {
  return input.ids.length > 0 ? { id: { in: input.ids } } : buildDealerWhere(input.filter);
}

/**
 * Gán nhân viên cho các dòng đã chọn, hoặc mọi đại lý khớp bộ lọc. Phạm vi dữ liệu áp trong truy vấn. K7b: chỉ
 * gán đại lý của đơn vị nhân viên thuộc về hoặc đơn vị cha; đại lý của đơn vị khác bỏ qua và báo số lượng.
 */
export async function bulkAssignDealers(input: BulkAssignDealersInput) {
  const assignee = await assertAssignableUser(input.assignedUserId, null);
  const scoped = await getScopedDb();
  const where = await targetWhere(input);
  const total = assignee ? await scoped.dealer.count({ where }) : 0;
  const result = await scoped.dealer.updateMany({
    where: assignee ? { AND: [where, { orgUnitId: { in: assignee.unitPath } }] } : where,
    data: { assignedUserId: input.assignedUserId },
  });
  return {
    count: result.count,
    skipped: assignee ? Math.max(0, total - result.count) : 0,
    userName: assignee?.name ?? null,
  };
}

/**
 * Đổi đơn vị phụ trách. K7b: nhân viên phụ trách không thuộc đơn vị mới hoặc đơn vị con được bỏ gán để chờ gán
 * lại, trả số đại lý bị bỏ gán để báo người đổi.
 */
export async function bulkMoveDealers(input: BulkMoveDealersInput) {
  const unitName = await assertAssignableUnit(input.orgUnitId);
  const scoped = await getScopedDb();
  // Lấy danh sách trước: bộ lọc có thể theo đơn vị cũ, đổi xong sẽ không khớp nữa.
  const ids = (
    await scoped.dealer.findMany({ where: await targetWhere(input), select: { id: true } })
  ).map((row) => row.id);
  const tree = await getOrgUnitTreeIds(input.orgUnitId);
  const [moved, cleared] = await db.$transaction([
    db.dealer.updateMany({ where: { id: { in: ids } }, data: { orgUnitId: input.orgUnitId } }),
    db.dealer.updateMany({
      where: {
        id: { in: ids },
        assignedUserId: { not: null },
        NOT: { assignedUser: { orgUnitId: { in: tree } } },
      },
      data: { assignedUserId: null },
    }),
  ]);
  return { count: moved.count, cleared: cleared.count, unitName };
}
