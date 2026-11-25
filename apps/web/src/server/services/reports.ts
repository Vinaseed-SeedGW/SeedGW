import 'server-only';
import type { Prisma } from '@prisma/client';
import { coversWholeMonths, monthsInRange } from '@seedgw/contracts/dashboard';
import type { DealerLevel } from '@seedgw/contracts/dealers';
import { vietnamDayStart, vietnamNextDayStart, vietnamToday } from '@seedgw/contracts/format';
import { collectDescendantIds } from '@seedgw/contracts/org-tree';
import type {
  DealerReportRow,
  ReportInput,
  ReportResult,
  ReportTarget,
  StaffReportRow,
  UnitReportRow,
} from '@seedgw/contracts/reports';
import {
  effectiveUnitTarget,
  effectiveUserTarget,
  type TargetValues,
} from '@seedgw/contracts/target-assignments';
import { db } from '@seedgw/db/client';
import { getOrgUnitTreeIds } from '@seedgw/db/org-units';
import type { ScopedDb } from '@seedgw/db/scoped-client';
import { getAssignableOrgUnitIds, getScopedDb } from '@/server/auth/scoped-db';
import { readProvinceFilter, type ProvinceFilter } from './regions';

// Báo cáo Kinh doanh (K5). Mọi truy vấn qua client có phạm vi dữ liệu của người xem; lọc đơn vị gồm đơn vị con.
// Tính thẳng từ dữ liệu gốc như Dashboard (bảng tổng hợp để D5 Hiệu năng).

const VN_OFFSET_MS = 7 * 3_600_000;

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function vnDay(date: Date): string {
  return new Date(date.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
}

type Context = {
  scoped: ScopedDb;
  input: ReportInput;
  unitIds: string[] | null;
  capturedAt: { gte: Date; lt: Date };
  months: string[] | null;
  // K7: lọc vùng, tỉnh theo tỉnh của đại lý.
  geo: ProvinceFilter | null;
  dealerGeo: Prisma.DealerWhereInput;
};

async function contextOf(input: ReportInput): Promise<Context> {
  const [scoped, unitIds, geo] = await Promise.all([
    getScopedDb(),
    input.orgUnitId ? getOrgUnitTreeIds(input.orgUnitId) : Promise.resolve(null),
    readProvinceFilter(input),
  ]);
  return {
    scoped,
    input,
    unitIds,
    capturedAt: { gte: vietnamDayStart(input.from), lt: vietnamNextDayStart(input.to) },
    // Chỉ tiêu giao theo đơn vị, nhân viên, không chia được theo tỉnh.
    months:
      coversWholeMonths(input.from, input.to, vietnamToday()) && !geo
        ? monthsInRange(input.from, input.to)
        : null,
    geo,
    dealerGeo: geo ? { provinceName: { in: geo.provinces } } : {},
  };
}

/** Km theo đường đi, lượt chưa tính lấy km GPS (V1b), cộng theo khoá nhóm. */
async function kmBy(
  ctx: Context,
  by: 'userId' | 'orgUnitId',
  where: Prisma.CheckInWhereInput,
): Promise<Map<string, number>> {
  const [road, gps] = await Promise.all([
    ctx.scoped.checkIn.groupBy({
      by: [by],
      where: { AND: [where, { roadDistanceKm: { not: null } }] },
      _sum: { roadDistanceKm: true },
    }),
    ctx.scoped.checkIn.groupBy({
      by: [by],
      where: { AND: [where, { roadDistanceKm: null }] },
      _sum: { gpsDistanceKm: true },
    }),
  ]);
  const result = new Map<string, number>();
  for (const row of road) {
    const key = row[by];
    if (key) result.set(key, (result.get(key) ?? 0) + (row._sum.roadDistanceKm ?? 0));
  }
  for (const row of gps) {
    const key = row[by];
    if (key) result.set(key, (result.get(key) ?? 0) + (row._sum.gpsDistanceKm ?? 0));
  }
  return result;
}

type MonthlyTargets = Map<string, Map<string, TargetValues | null>>;

function sumTargets(values: ReadonlyArray<TargetValues | null>): TargetValues | null {
  const known = values.filter((value): value is TargetValues => value !== null);
  if (known.length === 0) return null;
  return {
    visitCountTarget: known.reduce((sum, value) => sum + value.visitCountTarget, 0),
    dealerCoverageTarget: known.reduce((sum, value) => sum + value.dealerCoverageTarget, 0),
  };
}

/** Chỉ tiêu hiệu lực từng nhân viên theo từng tháng trong kỳ (K3). */
async function userTargets(userIds: string[], months: string[]): Promise<MonthlyTargets> {
  const [assigned, self] = await Promise.all([
    db.assignedSalesTarget.findMany({
      where: { kind: 'USER', userId: { in: userIds }, month: { in: months } },
      select: { userId: true, month: true, visitCountTarget: true, dealerCoverageTarget: true },
    }),
    db.monthlySalesTarget.findMany({
      where: { userId: { in: userIds }, month: { in: months }, approvedAt: { not: null } },
      select: { userId: true, month: true, approvedVisitCount: true, approvedDealerCoverage: true },
    }),
  ]);
  const key = (userId: string | null, month: string) => `${userId ?? ''}|${month}`;
  const assignedMap = new Map(assigned.map((row) => [key(row.userId, row.month), row]));
  const selfMap = new Map(
    self.map((row) => [
      key(row.userId, row.month),
      {
        visitCountTarget: row.approvedVisitCount ?? 0,
        dealerCoverageTarget: row.approvedDealerCoverage ?? 0,
      },
    ]),
  );
  const result: MonthlyTargets = new Map();
  for (const id of userIds) {
    const perMonth = new Map<string, TargetValues | null>();
    for (const month of months) {
      perMonth.set(
        month,
        effectiveUserTarget(
          assignedMap.get(key(id, month)) ?? null,
          selfMap.get(key(id, month)) ?? null,
        ),
      );
    }
    result.set(id, perMonth);
  }
  return result;
}

async function staffMembers(ctx: Context) {
  return ctx.scoped.user.findMany({
    where: {
      isActive: true,
      roles: { some: { role: { permissions: { some: { code: 'sales.check-in.create' } } } } },
      ...(ctx.input.employeeCode ? { employeeCode: ctx.input.employeeCode } : {}),
      AND: [
        ...(ctx.unitIds ? [{ orgUnitId: { in: ctx.unitIds } }] : []),
        ...(ctx.geo ? [{ orgUnitId: { in: ctx.geo.staffUnitIds } }] : []),
      ],
    },
    orderBy: { employeeCode: 'asc' },
    select: {
      id: true,
      employeeCode: true,
      fullName: true,
      orgUnitId: true,
      orgUnit: { select: { name: true } },
    },
  });
}

async function staffReport(ctx: Context): Promise<StaffReportRow[]> {
  const members = await staffMembers(ctx);
  const ids = members.map((member) => member.id);
  if (ids.length === 0) return [];
  const where: Prisma.CheckInWhereInput = {
    userId: { in: ids },
    capturedAt: ctx.capturedAt,
    ...(ctx.geo ? { dealer: ctx.dealerGeo } : {}),
  };
  const dealerActive: Prisma.DealerWhereInput = {
    ...ctx.dealerGeo,
    status: 'ACTIVE',
    assignedUserId: { in: ids },
    ...(ctx.input.level ? { level: ctx.input.level } : {}),
  };
  const today = vietnamToday();
  const end = ctx.input.to < today ? ctx.input.to : today;
  const [visits, pairs, km, assigned, assignedVisited, targets, plans] = await Promise.all([
    ctx.scoped.checkIn.groupBy({ by: ['userId'], where, _count: { _all: true } }),
    ctx.scoped.checkIn.groupBy({
      by: ['userId', 'dealerId'],
      where: { ...where, dealerId: { not: null } },
    }),
    kmBy(ctx, 'userId', where),
    ctx.scoped.dealer.groupBy({
      by: ['assignedUserId'],
      where: dealerActive,
      _count: { _all: true },
    }),
    ctx.scoped.dealer.groupBy({
      by: ['assignedUserId'],
      where: { ...dealerActive, checkIns: { some: { capturedAt: ctx.capturedAt } } },
      _count: { _all: true },
    }),
    ctx.months ? userTargets(ids, ctx.months) : Promise.resolve(null),
    end < ctx.input.from
      ? Promise.resolve([])
      : ctx.scoped.routePlan.findMany({
          where: { userId: { in: ids }, approvedRevision: { not: null } },
          select: {
            userId: true,
            approvedRevision: true,
            stops: {
              where: {
                day: { gte: ctx.input.from, lte: end },
                ...(ctx.geo ? { dealer: ctx.dealerGeo } : {}),
              },
              select: { revision: true, day: true, dealerId: true },
            },
          },
        }),
  ]);
  const visitMap = new Map(visits.map((row) => [row.userId, row._count._all]));
  const dealerCount = new Map<string, number>();
  const visitedKeys = new Set<string>();
  for (const row of pairs) dealerCount.set(row.userId, (dealerCount.get(row.userId) ?? 0) + 1);
  const assignedMap = new Map(assigned.map((row) => [row.assignedUserId, row._count._all]));
  const assignedVisitedMap = new Map(
    assignedVisited.map((row) => [row.assignedUserId, row._count._all]),
  );

  // Tuyến: điểm trong bản đã duyệt tới hôm nay, có check-in đúng đại lý đúng ngày.
  const planned = plans.flatMap((plan) =>
    plan.stops
      .filter((stop) => stop.revision === plan.approvedRevision)
      .map((stop) => ({ userId: plan.userId, key: `${plan.userId}|${stop.dealerId}|${stop.day}` })),
  );
  if (planned.length > 0) {
    const done = await ctx.scoped.checkIn.findMany({
      where: {
        userId: { in: [...new Set(planned.map((stop) => stop.userId))] },
        dealerId: { not: null },
        capturedAt: { gte: vietnamDayStart(ctx.input.from), lt: vietnamNextDayStart(end) },
      },
      select: { userId: true, dealerId: true, capturedAt: true },
    });
    for (const row of done)
      visitedKeys.add(`${row.userId}|${row.dealerId}|${vnDay(row.capturedAt)}`);
  }
  const routePlanned = new Map<string, number>();
  const routeVisited = new Map<string, number>();
  for (const stop of planned) {
    routePlanned.set(stop.userId, (routePlanned.get(stop.userId) ?? 0) + 1);
    if (visitedKeys.has(stop.key)) {
      routeVisited.set(stop.userId, (routeVisited.get(stop.userId) ?? 0) + 1);
    }
  }

  return members.map((member) => ({
    code: member.employeeCode,
    name: member.fullName,
    orgUnitName: member.orgUnit?.name ?? null,
    visits: visitMap.get(member.id) ?? 0,
    dealersVisited: dealerCount.get(member.id) ?? 0,
    assignedDealers: assignedMap.get(member.id) ?? 0,
    assignedVisited: assignedVisitedMap.get(member.id) ?? 0,
    km: round3(km.get(member.id) ?? 0),
    target: targets ? sumTargets([...(targets.get(member.id)?.values() ?? [])]) : null,
    routePlanned: routePlanned.get(member.id) ?? 0,
    routeVisited: routeVisited.get(member.id) ?? 0,
  }));
}

async function unitReport(ctx: Context): Promise<UnitReportRow[]> {
  const [all, assignable] = await Promise.all([
    db.orgUnit.findMany({
      orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true, parentId: true },
    }),
    getAssignableOrgUnitIds(),
  ]);
  let units = assignable ? all.filter((unit) => assignable.has(unit.id)) : all;
  if (ctx.unitIds) units = units.filter((unit) => ctx.unitIds?.includes(unit.id));
  if (ctx.geo) units = units.filter((unit) => ctx.geo?.relatedUnitIds.has(unit.id));
  const where: Prisma.CheckInWhereInput = {
    capturedAt: ctx.capturedAt,
    orgUnitId: { not: null },
    ...(ctx.input.employeeCode ? { user: { employeeCode: ctx.input.employeeCode } } : {}),
    ...(ctx.geo ? { dealer: ctx.dealerGeo } : {}),
  };
  const dealerActive: Prisma.DealerWhereInput = {
    ...ctx.dealerGeo,
    status: 'ACTIVE',
    ...(ctx.input.level ? { level: ctx.input.level } : {}),
  };
  const [visits, pairs, km, active, members] = await Promise.all([
    ctx.scoped.checkIn.groupBy({ by: ['orgUnitId'], where, _count: { _all: true } }),
    ctx.scoped.checkIn.groupBy({
      by: ['orgUnitId', 'dealerId'],
      where: { ...where, dealerId: { not: null } },
    }),
    kmBy(ctx, 'orgUnitId', where),
    ctx.scoped.dealer.groupBy({ by: ['orgUnitId'], where: dealerActive, _count: { _all: true } }),
    ctx.months ? staffMembers({ ...ctx, unitIds: null }) : Promise.resolve([]),
  ]);
  const [memberTargets, unitAssigned] = ctx.months
    ? await Promise.all([
        userTargets(
          members.map((member) => member.id),
          ctx.months,
        ),
        db.assignedSalesTarget.findMany({
          where: {
            kind: 'UNIT',
            orgUnitId: { in: units.map((unit) => unit.id) },
            month: { in: ctx.months },
          },
          select: {
            orgUnitId: true,
            month: true,
            visitCountTarget: true,
            dealerCoverageTarget: true,
          },
        }),
      ])
    : [null, []];

  return units.map((unit) => {
    const tree = collectDescendantIds(all, unit.id);
    tree.add(unit.id);
    const inTree = (id: string | null) => id !== null && tree.has(id);
    const dealers = new Set<string>();
    for (const row of pairs) if (inTree(row.orgUnitId) && row.dealerId) dealers.add(row.dealerId);
    // Mỗi tháng: chỉ tiêu giao cho đơn vị, chưa giao thì cộng chỉ tiêu nhân viên trong đơn vị và đơn vị con.
    let target: ReportTarget | null = null;
    if (ctx.months && memberTargets) {
      const treeMembers = members.filter((member) => inTree(member.orgUnitId));
      target = sumTargets(
        ctx.months.map((month) =>
          effectiveUnitTarget(
            unitAssigned.find((row) => row.orgUnitId === unit.id && row.month === month) ?? null,
            treeMembers.map((member) => memberTargets.get(member.id)?.get(month) ?? null),
          ),
        ),
      );
    }
    return {
      id: unit.id,
      code: unit.code,
      name: unit.name,
      visits: visits.reduce((sum, row) => sum + (inTree(row.orgUnitId) ? row._count._all : 0), 0),
      dealersVisited: dealers.size,
      activeDealers: active.reduce(
        (sum, row) => sum + (inTree(row.orgUnitId) ? row._count._all : 0),
        0,
      ),
      km: round3([...km].reduce((sum, [id, value]) => sum + (inTree(id) ? value : 0), 0)),
      target,
    };
  });
}

async function dealerReport(
  ctx: Context,
  all: boolean,
): Promise<{ rows: DealerReportRow[]; total: number }> {
  const where: Prisma.DealerWhereInput = {
    ...ctx.dealerGeo,
    status: 'ACTIVE',
    ...(ctx.input.level ? { level: ctx.input.level } : {}),
    ...(ctx.unitIds ? { orgUnitId: { in: ctx.unitIds } } : {}),
    ...(ctx.input.employeeCode ? { assignedUser: { employeeCode: ctx.input.employeeCode } } : {}),
  };
  const [total, visits] = await Promise.all([
    ctx.scoped.dealer.count({ where }),
    ctx.scoped.checkIn.groupBy({
      by: ['dealerId'],
      where: { capturedAt: ctx.capturedAt, dealerId: { not: null }, dealer: where },
      _count: { _all: true },
      _max: { capturedAt: true },
    }),
  ]);
  // Đại lý có lượt ghé lên trước, nhiều lượt nhất lên đầu; sau đó tới đại lý chưa ghé, xếp theo tên.
  const visited = visits
    .filter((row): row is typeof row & { dealerId: string } => row.dealerId !== null)
    .sort((a, b) => b._count._all - a._count._all);
  const offset = all ? 0 : (ctx.input.page - 1) * ctx.input.pageSize;
  const limit = all ? total : ctx.input.pageSize;
  const visitedSlice = visited.slice(offset, offset + limit);
  const restOffset = Math.max(0, offset - visited.length);
  const restLimit = limit - visitedSlice.length;
  const select = {
    id: true,
    code: true,
    legacyCode: true,
    name: true,
    level: true,
    orgUnit: { select: { name: true } },
    assignedUser: { select: { fullName: true } },
  } satisfies Prisma.DealerSelect;
  const [visitedDealers, rest] = await Promise.all([
    ctx.scoped.dealer.findMany({
      where: { id: { in: visitedSlice.map((row) => row.dealerId) } },
      select,
    }),
    restLimit > 0
      ? ctx.scoped.dealer.findMany({
          where: { ...where, id: { notIn: visited.map((row) => row.dealerId) } },
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
          skip: restOffset,
          take: restLimit,
          select,
        })
      : Promise.resolve([]),
  ]);
  const byId = new Map(visitedDealers.map((dealer) => [dealer.id, dealer]));
  const toRow = (
    dealer: (typeof visitedDealers)[number],
    count: number,
    last: Date | null,
  ): DealerReportRow => ({
    id: dealer.id,
    code: dealer.code ?? dealer.legacyCode,
    name: dealer.name,
    level: dealer.level as DealerLevel,
    orgUnitName: dealer.orgUnit?.name ?? null,
    assignedUserName: dealer.assignedUser?.fullName ?? null,
    visits: count,
    lastVisitedAt: last?.toISOString() ?? null,
  });
  const rows = [
    ...visitedSlice.flatMap((row) => {
      const dealer = byId.get(row.dealerId);
      return dealer ? [toRow(dealer, row._count._all, row._max.capturedAt)] : [];
    }),
    ...rest.map((dealer) => toRow(dealer, 0, null)),
  ];
  return { rows, total };
}

export async function readReport(input: ReportInput, exportAll = false): Promise<ReportResult> {
  const ctx = await contextOf(input);
  if (input.group === 'don-vi') {
    return { group: 'don-vi', rows: await unitReport(ctx), targetMonths: ctx.months };
  }
  if (input.group === 'dai-ly') {
    const { rows, total } = await dealerReport(ctx, exportAll);
    return { group: 'dai-ly', rows, total, page: input.page, pageSize: input.pageSize };
  }
  return { group: 'nhan-vien', rows: await staffReport(ctx), targetMonths: ctx.months };
}
