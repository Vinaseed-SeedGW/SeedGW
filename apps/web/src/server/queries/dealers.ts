import 'server-only';
import type { Prisma } from '@prisma/client';
import type { PermissionCode } from '@seedgw/contracts/access';
import type { CheckInRow } from '@seedgw/contracts/check-ins';
import type {
  DealerDetail,
  DealerFormOptions,
  DealerLevel,
  DealerSummary,
  ListDealersInput,
  ListDealersResult,
} from '@seedgw/contracts/dealers';
import { db } from '@seedgw/db/client';
import { mapTileConfig } from '@/server/integrations/map-tiles';
import { assertCan, can } from '@/server/auth/can';
import { requireUser } from '@/server/auth/current-user';
import { getAssignableOrgUnitIds, getScopedDb } from '@/server/auth/scoped-db';
import { buildOrgUnitLabels } from '@/server/queries/users';
import { CHECK_IN_ROW_SELECT, toCheckInRow } from '@/server/services/check-in-report';
import { dealerWhere, loadVisitCutoffs } from '@/server/services/dealers';

// Một hồ sơ, hai lối vào (IA §1): Kinh doanh dùng quyền sales.dealer.read, Quản trị dùng admin.dealer.read.
export type DealerEntry = Extract<PermissionCode, 'sales.dealer.read' | 'admin.dealer.read'>;

const SUMMARY_SELECT = {
  id: true,
  code: true,
  legacyCode: true,
  name: true,
  level: true,
  status: true,
  phone: true,
  provinceName: true,
  lat: true,
  legacyAssigneeName: true,
  lastVisitedAt: true,
  orgUnit: { select: { name: true } },
  assignedUser: { select: { fullName: true } },
} satisfies Prisma.DealerSelect;

type SummaryRecord = Prisma.DealerGetPayload<{ select: typeof SUMMARY_SELECT }>;

function toSummary(row: SummaryRecord): DealerSummary {
  return {
    id: row.id,
    code: row.code,
    legacyCode: row.legacyCode,
    name: row.name,
    level: row.level as DealerLevel,
    status: row.status,
    phone: row.phone,
    provinceName: row.provinceName,
    orgUnitName: row.orgUnit?.name ?? null,
    assignedUserName: row.assignedUser?.fullName ?? null,
    legacyAssigneeName: row.legacyAssigneeName,
    hasLocation: row.lat !== null,
    lastVisitedAt: row.lastVisitedAt?.toISOString() ?? null,
  };
}

const ORDER_BY: Record<ListDealersInput['sort'], Prisma.DealerOrderByWithRelationInput[]> = {
  name: [{ name: 'asc' }, { id: 'asc' }],
  '-name': [{ name: 'desc' }, { id: 'asc' }],
  code: [{ code: { sort: 'asc', nulls: 'last' } }, { legacyCode: 'asc' }],
  '-code': [{ code: { sort: 'desc', nulls: 'last' } }, { legacyCode: 'desc' }],
  '-updatedAt': [{ updatedAt: 'desc' }, { id: 'asc' }],
};

/** Nhân viên chỉ thấy đại lý được giao, quản lý thấy theo đơn vị (phạm vi dữ liệu của vai trò). */
export async function listDealers(
  input: ListDealersInput,
  entry: DealerEntry,
): Promise<ListDealersResult> {
  const [user, scoped] = await Promise.all([requireUser(), getScopedDb()]);
  assertCan(user, entry);

  const where = dealerWhere(input, await loadVisitCutoffs());
  const [rows, total] = await Promise.all([
    scoped.dealer.findMany({
      where,
      orderBy: ORDER_BY[input.sort],
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
      select: SUMMARY_SELECT,
    }),
    scoped.dealer.count({ where }),
  ]);
  return { items: rows.map(toSummary), total, page: input.page, pageSize: input.pageSize };
}

export async function getDealer(id: string, entry: DealerEntry): Promise<DealerDetail | null> {
  const [user, scoped] = await Promise.all([requireUser(), getScopedDb()]);
  assertCan(user, entry);

  const row = await scoped.dealer.findUnique({
    where: { id },
    select: {
      ...SUMMARY_SELECT,
      taxCode: true,
      phoneRaw: true,
      ownerName: true,
      ownerPhone: true,
      address: true,
      legacyAdminArea: true,
      lng: true,
      locatedAt: true,
      orgUnitId: true,
      assignedUserId: true,
      legacyOrgUnitName: true,
      createdAt: true,
      updatedAt: true,
      parent: { select: { id: true, name: true, code: true, legacyCode: true } },
      mergedInto: { select: { id: true, name: true } },
      checkIns: {
        orderBy: { capturedAt: 'desc' },
        take: 1,
        select: { lat: true, lng: true },
      },
    },
  });
  if (!row) return null;
  return {
    ...toSummary(row),
    taxCode: row.taxCode,
    phoneRaw: row.phoneRaw,
    ownerName: row.ownerName,
    ownerPhone: row.ownerPhone,
    address: row.address,
    legacyAdminArea: row.legacyAdminArea,
    lat: row.lat,
    lng: row.lng,
    locatedAt: row.locatedAt?.toISOString() ?? null,
    parent: row.parent,
    orgUnitId: row.orgUnitId,
    assignedUserId: row.assignedUserId,
    legacyOrgUnitName: row.legacyOrgUnitName,
    lastCheckInPoint: row.checkIns[0] ?? null,
    mergedInto: row.mergedInto,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const VISIT_LIMIT = 30;

/** Tab Viếng thăm: các lượt check-in gần nhất tại đại lý, theo phạm vi xem check-in của người dùng. */
export async function listDealerVisits(dealerId: string): Promise<CheckInRow[] | null> {
  const [user, scoped] = await Promise.all([requireUser(), getScopedDb()]);
  if (!can(user, 'sales.check-in.read')) return null;
  const rows = await scoped.checkIn.findMany({
    where: { dealerId },
    orderBy: { capturedAt: 'desc' },
    take: VISIT_LIMIT,
    select: CHECK_IN_ROW_SELECT,
  });
  const now = Date.now();
  return rows.map((row) => toCheckInRow(row, now));
}

export async function getDealerFormOptions(): Promise<DealerFormOptions> {
  const [user, scoped, assignable] = await Promise.all([
    requireUser(),
    getScopedDb(),
    getAssignableOrgUnitIds(),
  ]);
  if (!can(user, 'sales.dealer.update') && !can(user, 'admin.dealer.manage')) {
    return {
      orgUnits: [],
      users: [],
      canEdit: false,
      canMoveOrgUnit: false,
      mapTiles: mapTileConfig(),
    };
  }
  const [units, users] = await Promise.all([
    db.orgUnit.findMany({ select: { id: true, name: true, parentId: true } }),
    scoped.user.findMany({
      where: { isActive: true },
      orderBy: { employeeCode: 'asc' },
      select: { id: true, employeeCode: true, fullName: true },
    }),
  ]);
  const labels = buildOrgUnitLabels(units);
  const orgUnits = assignable ? labels.filter((unit) => assignable.has(unit.value)) : labels;
  return {
    orgUnits,
    users: users.map((row) => ({ value: row.id, label: `${row.employeeCode} - ${row.fullName}` })),
    canEdit: true,
    canMoveOrgUnit: orgUnits.length > 0,
    mapTiles: mapTileConfig(),
  };
}

/** Bộ lọc đơn vị trên danh sách: các đơn vị đang có đại lý trong phạm vi. */
export async function listDealerOrgUnitFilter(): Promise<{ value: string; label: string }[]> {
  const scoped = await getScopedDb();
  const [groups, units] = await Promise.all([
    scoped.dealer.groupBy({ by: ['orgUnitId'], _count: { _all: true } }),
    db.orgUnit.findMany({ select: { id: true, name: true } }),
  ]);
  const names = new Map(units.map((unit) => [unit.id, unit.name]));
  return groups
    .filter((group) => group.orgUnitId)
    .map((group) => ({
      value: group.orgUnitId ?? '',
      label: `${names.get(group.orgUnitId ?? '') ?? 'Đơn vị đã xoá'} (${group._count._all})`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'vi'));
}
