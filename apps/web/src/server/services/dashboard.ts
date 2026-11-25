import 'server-only';
import type { Prisma } from '@prisma/client';
import type { CheckInPlaceKind } from '@seedgw/contracts/check-ins';
import {
  bucketSeries,
  lastYearRange,
  monthsInRange,
  coversWholeMonths,
  previousRange,
  type DashboardInput,
  type DashboardRanking,
  type DashboardResult,
  type PeriodFigures,
} from '@seedgw/contracts/dashboard';
import {
  effectiveUnitTarget,
  effectiveUserTarget,
  type TargetSource,
  type TargetValues,
} from '@seedgw/contracts/target-assignments';
import type { ScopedDb } from '@seedgw/db/scoped-client';
import type { DealerLevel } from '@seedgw/contracts/dealers';
import { vietnamDayStart, vietnamNextDayStart, vietnamToday } from '@seedgw/contracts/format';
import { db } from '@seedgw/db/client';
import { getOrgUnitTreeIds } from '@seedgw/db/org-units';
import { getScopedDb } from '@/server/auth/scoped-db';
import { readProvinceFilter, type ProvinceFilter } from './regions';
import { readSystemSettings } from './settings';

const DAY_MS = 86_400_000;
const VN_OFFSET_MS = 7 * 3_600_000;
const LEVELS: DealerLevel[] = [1, 2, 3];
const OVERDUE_LIST_SIZE = 20;
const RANKING_SIZE = 20;
const NOT_CHECKED_IN_LIST_SIZE = 50;
// Nhân viên đi thị trường là tài khoản vai trò Cán bộ nhân viên (duyệt K0); đổi theo khi có F3b.
const FIELD_STAFF_ROLE = 'staff';

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function vnDay(date: Date): string {
  return new Date(date.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * Số liệu dashboard check-in (K0). Mọi truy vấn qua client có phạm vi dữ liệu của người xem; bộ lọc đơn vị
 * gồm cả đơn vị con. Biểu đồ theo ngày đọc bảng gộp K1 (daily_visit_stats), các số khác đếm thẳng vì CSDL trả nhanh.
 */
export async function readDashboard(
  input: DashboardInput,
  showStaff: boolean,
  now = new Date(),
): Promise<DashboardResult> {
  const [scoped, settings, unitIds, geo] = await Promise.all([
    getScopedDb(),
    readSystemSettings(),
    input.orgUnitId ? getOrgUnitTreeIds(input.orgUnitId) : Promise.resolve(null),
    readProvinceFilter(input),
  ]);
  // K7: lọc vùng, tỉnh tính theo tỉnh của đại lý, nên chỉ còn lượt ghé đại lý.
  const inProvinces = geo ? { provinceName: { in: geo.provinces } } : null;
  const from = vietnamDayStart(input.from);
  const to = vietnamNextDayStart(input.to);
  const today = vietnamToday(now);

  const checkInScope: Prisma.CheckInWhereInput = {
    ...(unitIds ? { orgUnitId: { in: unitIds } } : {}),
    ...(input.employeeCode ? { user: { employeeCode: input.employeeCode } } : {}),
    ...(inProvinces ? { dealer: inProvinces } : {}),
  };
  const inPeriod: Prisma.CheckInWhereInput = { ...checkInScope, capturedAt: { gte: from, lt: to } };
  const dealerScope: Prisma.DealerWhereInput = {
    status: 'ACTIVE',
    ...(input.level ? { level: input.level } : {}),
    ...(unitIds ? { orgUnitId: { in: unitIds } } : {}),
    ...(input.employeeCode ? { assignedUser: { employeeCode: input.employeeCode } } : {}),
    ...(inProvinces ?? {}),
  };
  // K1: bảng gộp theo ngày, cùng bộ lọc với check-in (đơn vị lúc check-in, nhân viên, tỉnh của đại lý).
  const statsScope: Prisma.DailyVisitStatWhereInput = {
    ...(unitIds ? { orgUnitId: { in: unitIds } } : {}),
    ...(input.employeeCode ? { user: { employeeCode: input.employeeCode } } : {}),
    ...(inProvinces ?? {}),
  };
  const visitedInPeriod: Prisma.DealerWhereInput = {
    ...dealerScope,
    checkIns: { some: { capturedAt: { gte: from, lt: to } } },
  };
  const staffScope: Prisma.UserWhereInput = {
    isActive: true,
    roles: { some: { role: { code: FIELD_STAFF_ROLE } } },
    ...(input.employeeCode ? { employeeCode: input.employeeCode } : {}),
    AND: [
      ...(unitIds ? [{ orgUnitId: { in: unitIds } }] : []),
      // Lọc tỉnh: nhân viên của đơn vị phụ trách tỉnh đó và đơn vị con.
      ...(geo ? [{ orgUnitId: { in: geo.staffUnitIds } }] : []),
    ],
  };

  const overdueDays: Record<DealerLevel, number> = {
    1: settings.values.dealerUnvisitedDaysLevel1,
    2: settings.values.dealerUnvisitedDaysLevel2,
    3: settings.values.dealerUnvisitedDaysLevel3,
  };
  const cutoff = (level: DealerLevel) => new Date(now.getTime() - overdueDays[level] * DAY_MS);
  const overdueWhere: Prisma.DealerWhereInput = {
    ...dealerScope,
    OR: LEVELS.map((level) => ({ level, lastVisitedAt: { lt: cutoff(level) } })),
  };

  const [
    visits,
    byKindRows,
    roadSum,
    gpsFallbackSum,
    gpsFallbackVisits,
    flagged,
    dailyVisits,
    activeDealers,
    coveredDealers,
    todayUsers,
    staffTotal,
    overdueCounts,
    neverVisited,
    missingLocation,
    unassigned,
    overdueRows,
    activeByLevel,
    coveredByLevel,
    activeByUnit,
    coveredByUnit,
  ] = await Promise.all([
    scoped.checkIn.count({ where: inPeriod }),
    scoped.checkIn.groupBy({ by: ['placeKind'], where: inPeriod, _count: { _all: true } }),
    scoped.checkIn.aggregate({
      where: { AND: [inPeriod, { roadDistanceKm: { not: null } }] },
      _sum: { roadDistanceKm: true },
      _count: { _all: true },
    }),
    scoped.checkIn.aggregate({
      where: { AND: [inPeriod, { roadDistanceKm: null }] },
      _sum: { gpsDistanceKm: true },
    }),
    scoped.checkIn.count({
      where: { AND: [inPeriod, { roadDistanceKm: null }, { gpsDistanceKm: { gt: 0 } }] },
    }),
    scoped.checkIn.count({ where: { ...inPeriod, flags: { isEmpty: false } } }),
    readDailyVisits(scoped, statsScope, checkInScope, input, today),
    scoped.dealer.count({ where: dealerScope }),
    scoped.dealer.count({ where: visitedInPeriod }),
    scoped.checkIn.groupBy({
      by: ['userId'],
      where: {
        ...checkInScope,
        capturedAt: { gte: vietnamDayStart(today), lt: vietnamNextDayStart(today) },
      },
    }),
    scoped.user.count({ where: staffScope }),
    Promise.all(
      LEVELS.map((level) =>
        scoped.dealer.count({
          where: { ...dealerScope, level, lastVisitedAt: { lt: cutoff(level) } },
        }),
      ),
    ),
    scoped.dealer.count({ where: { ...dealerScope, lastVisitedAt: null } }),
    scoped.dealer.count({ where: { ...dealerScope, lat: null } }),
    scoped.dealer.count({ where: { ...dealerScope, assignedUserId: null } }),
    scoped.dealer.findMany({
      where: overdueWhere,
      orderBy: [{ lastVisitedAt: 'asc' }, { name: 'asc' }],
      take: OVERDUE_LIST_SIZE,
      select: {
        id: true,
        name: true,
        level: true,
        lastVisitedAt: true,
        assignedUser: { select: { fullName: true } },
      },
    }),
    scoped.dealer.groupBy({ by: ['level'], where: dealerScope, _count: { _all: true } }),
    scoped.dealer.groupBy({ by: ['level'], where: visitedInPeriod, _count: { _all: true } }),
    scoped.dealer.groupBy({ by: ['orgUnitId'], where: dealerScope, _count: { _all: true } }),
    scoped.dealer.groupBy({ by: ['orgUnitId'], where: visitedInPeriod, _count: { _all: true } }),
  ]);

  // K4c: gộp lượt ghé theo ngày, tuần hoặc tháng tuỳ độ dài kỳ.
  const chart = bucketSeries(input.from, input.to, dailyVisits);
  const byKind: Record<CheckInPlaceKind, number> = { DEALER: 0, CUSTOMER: 0, OTHER: 0 };
  for (const row of byKindRows) byKind[row.placeKind] = row._count._all;
  // Km chính là km theo đường đi; lượt máy chủ chưa tính (hoặc chưa bật) lấy km theo GPS (V1b).
  const km = round3((roadSum._sum.roadDistanceKm ?? 0) + (gpsFallbackSum._sum.gpsDistanceKm ?? 0));

  const unitIdsInUse = activeByUnit.flatMap((row) => (row.orgUnitId ? [row.orgUnitId] : []));
  const unitNames = new Map(
    (
      await db.orgUnit.findMany({
        where: { id: { in: unitIdsInUse } },
        select: { id: true, name: true },
      })
    ).map((unit) => [unit.id, unit.name]),
  );
  const coveredUnit = new Map(coveredByUnit.map((row) => [row.orgUnitId, row._count._all]));

  // K4: so sánh, chỉ tiêu, tuyến, đại lý mới.
  const figuresOf = (range: { from: string; to: string }) =>
    periodFigures(scoped, checkInScope, dealerScope, range);
  const [previous, lastYear, target, routes, newDealers] = await Promise.all([
    figuresOf(previousRange(input.from, input.to)),
    figuresOf(lastYearRange(input.from, input.to)),
    // Chỉ tiêu giao theo đơn vị, nhân viên, không chia được theo tỉnh.
    coversWholeMonths(input.from, input.to, today) && !geo
      ? readTarget(scoped, input, unitIds, monthsInRange(input.from, input.to))
      : Promise.resolve(null),
    readRouteCompletion(scoped, input, unitIds, today, geo),
    scoped.dealerProposal.count({
      where: {
        status: 'APPROVED',
        reviewedAt: { gte: from, lt: to },
        ...(unitIds ? { orgUnitId: { in: unitIds } } : {}),
        ...(input.employeeCode ? { proposedBy: { employeeCode: input.employeeCode } } : {}),
        ...(inProvinces ? { dealer: inProvinces } : {}),
      },
    }),
  ]);
  const coveredLevel = new Map(coveredByLevel.map((row) => [row.level, row._count._all]));

  return {
    updatedAt: now.toISOString(),
    compare: { previous, lastYear },
    target,
    routes,
    newDealers,
    kpi: {
      visits,
      coverage: { active: activeDealers, covered: coveredDealers },
      staffCheckedInToday: todayUsers.length,
      staffTotal,
      km,
      kmSource: { roadVisits: roadSum._count._all, gpsVisits: gpsFallbackVisits },
    },
    market: {
      bucket: chart.bucket,
      series: chart.series,
      byKind,
      kmPerVisit: visits > 0 ? round3(km / visits) : null,
      flagged,
    },
    dealers: {
      overdueByLevel: {
        1: overdueCounts[0] ?? 0,
        2: overdueCounts[1] ?? 0,
        3: overdueCounts[2] ?? 0,
      },
      overdueDays,
      neverVisited,
      missingLocation,
      unassigned,
      overdueList: overdueRows.map((row) => ({
        id: row.id,
        name: row.name,
        level: row.level as DealerLevel,
        assignedUserName: row.assignedUser?.fullName ?? null,
        lastVisitedAt: (row.lastVisitedAt ?? now).toISOString(),
        days: Math.floor((now.getTime() - (row.lastVisitedAt ?? now).getTime()) / DAY_MS),
      })),
      coverageByLevel: activeByLevel
        .map((row) => ({
          level: row.level as DealerLevel,
          active: row._count._all,
          covered: coveredLevel.get(row.level) ?? 0,
        }))
        .sort((a, b) => a.level - b.level),
      coverageByUnit: activeByUnit
        .map((row) => ({
          unitName: row.orgUnitId
            ? (unitNames.get(row.orgUnitId) ?? 'Đơn vị đã xoá')
            : 'Chưa có đơn vị',
          active: row._count._all,
          covered: coveredUnit.get(row.orgUnitId) ?? 0,
        }))
        .sort((a, b) => a.unitName.localeCompare(b.unitName, 'vi')),
    },
    staff: showStaff
      ? await readStaff(staffScope, inPeriod, checkInScope, today, {
          dealerFilter: inProvinces ?? {},
          capturedAt: { gte: from, lt: to },
          rankBy: input.rankBy,
        })
      : null,
  };
}

function utcDate(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

/**
 * Số lượt theo ngày cho biểu đồ (K1): các ngày đã qua đọc bảng gộp daily_visit_stats, ngày hôm nay đếm thẳng từ
 * check-in để số luôn mới. Trước đây kéo từng lượt check-in của cả kỳ về máy chủ, kỳ Năm mất vài giây.
 */
async function readDailyVisits(
  scoped: ScopedDb,
  statsScope: Prisma.DailyVisitStatWhereInput,
  checkInScope: Prisma.CheckInWhereInput,
  input: DashboardInput,
  today: string,
): Promise<{ day: string; visits: number }[]> {
  const statsTo = input.to < today ? input.to : shiftIso(today, -1);
  const [stats, todayRows] = await Promise.all([
    input.from <= statsTo
      ? scoped.dailyVisitStat.groupBy({
          by: ['day'],
          where: { ...statsScope, day: { gte: utcDate(input.from), lte: utcDate(statsTo) } },
          _sum: { visits: true },
        })
      : Promise.resolve([]),
    input.to >= today
      ? scoped.checkIn.count({
          where: {
            ...checkInScope,
            capturedAt: { gte: vietnamDayStart(today), lt: vietnamNextDayStart(today) },
          },
        })
      : Promise.resolve(0),
  ]);
  return [
    ...stats.map((row) => ({
      day: row.day.toISOString().slice(0, 10),
      visits: row._sum.visits ?? 0,
    })),
    ...(input.to >= today ? [{ day: today, visits: todayRows }] : []),
  ];
}

async function readStaff(
  staffScope: Prisma.UserWhereInput,
  inPeriod: Prisma.CheckInWhereInput,
  checkInScope: Prisma.CheckInWhereInput,
  today: string,
  options: {
    dealerFilter: Prisma.DealerWhereInput;
    capturedAt: { gte: Date; lt: Date };
    rankBy: DashboardRanking;
  },
): Promise<DashboardResult['staff']> {
  const { dealerFilter, capturedAt, rankBy } = options;
  const scoped = await getScopedDb();
  const [
    perUser,
    perUserRoad,
    perUserGps,
    perUserDealer,
    assigned,
    assignedVisitedRows,
    staff,
    todayUsers,
  ] = await Promise.all([
    scoped.checkIn.groupBy({
      by: ['userId'],
      where: inPeriod,
      _count: { _all: true },
    }),
    scoped.checkIn.groupBy({
      by: ['userId'],
      where: { AND: [inPeriod, { roadDistanceKm: { not: null } }] },
      _sum: { roadDistanceKm: true },
    }),
    scoped.checkIn.groupBy({
      by: ['userId'],
      where: { AND: [inPeriod, { roadDistanceKm: null }] },
      _sum: { gpsDistanceKm: true },
    }),
    scoped.checkIn.groupBy({
      by: ['userId', 'dealerId'],
      where: { ...inPeriod, dealerId: { not: null } },
    }),
    scoped.dealer.groupBy({
      by: ['assignedUserId'],
      where: { ...dealerFilter, status: 'ACTIVE', assignedUserId: { not: null } },
      _count: { _all: true },
    }),
    scoped.dealer.groupBy({
      by: ['assignedUserId'],
      where: {
        ...dealerFilter,
        status: 'ACTIVE',
        assignedUserId: { not: null },
        checkIns: { some: { capturedAt } },
      },
      _count: { _all: true },
    }),
    scoped.user.findMany({
      where: staffScope,
      orderBy: { employeeCode: 'asc' },
      select: {
        id: true,
        employeeCode: true,
        fullName: true,
        orgUnit: { select: { name: true } },
      },
    }),
    scoped.checkIn.groupBy({
      by: ['userId'],
      where: {
        ...checkInScope,
        capturedAt: { gte: vietnamDayStart(today), lt: vietnamNextDayStart(today) },
      },
    }),
  ]);
  const visits = new Map(perUser.map((row) => [row.userId, row]));
  const kmByUser = new Map<string, number>();
  for (const row of perUserRoad) kmByUser.set(row.userId, row._sum.roadDistanceKm ?? 0);
  for (const row of perUserGps) {
    kmByUser.set(row.userId, (kmByUser.get(row.userId) ?? 0) + (row._sum.gpsDistanceKm ?? 0));
  }
  const covered = new Map<string, number>();
  for (const row of perUserDealer) covered.set(row.userId, (covered.get(row.userId) ?? 0) + 1);
  const assignedCount = new Map(assigned.map((row) => [row.assignedUserId, row._count._all]));
  const assignedVisited = new Map(
    assignedVisitedRows.map((row) => [row.assignedUserId, row._count._all]),
  );
  const checkedIn = new Set(todayUsers.map((row) => row.userId));
  // Người ngoài danh sách NVKD nhưng có check-in (ví dụ tài khoản quản trị đi thử) vẫn vào xếp hạng.
  const people = new Map(staff.map((user) => [user.id, user]));
  const missing = perUser.filter((row) => !people.has(row.userId)).map((row) => row.userId);
  if (missing.length > 0) {
    const extra = await scoped.user.findMany({
      where: { id: { in: missing } },
      select: { id: true, employeeCode: true, fullName: true, orgUnit: { select: { name: true } } },
    });
    for (const user of extra) people.set(user.id, user);
  }

  const ranking = [...people.values()]
    .map((user) => ({
      code: user.employeeCode,
      name: user.fullName,
      orgUnitName: user.orgUnit?.name ?? null,
      visits: visits.get(user.id)?._count._all ?? 0,
      coveredDealers: covered.get(user.id) ?? 0,
      assignedDealers: assignedCount.get(user.id) ?? 0,
      assignedVisited: assignedVisited.get(user.id) ?? 0,
      km: round3(kmByUser.get(user.id) ?? 0),
    }))
    .filter((row) => row.visits > 0)
    .sort(RANKING_ORDER[rankBy])
    .slice(0, RANKING_SIZE);
  const notCheckedIn = staff.filter((user) => !checkedIn.has(user.id));
  return {
    ranking,
    notCheckedInToday: notCheckedIn.slice(0, NOT_CHECKED_IN_LIST_SIZE).map((user) => ({
      code: user.employeeCode,
      name: user.fullName,
      orgUnitName: user.orgUnit?.name ?? null,
    })),
    notCheckedInTotal: notCheckedIn.length,
  };
}

type RankingRow = NonNullable<DashboardResult['staff']>['ranking'][number];

/** Độ phủ đại lý phụ trách; nhân viên chưa được giao đại lý xếp sau cùng. */
function assignedCoverage(row: RankingRow): number {
  return row.assignedDealers > 0 ? row.assignedVisited / row.assignedDealers : -1;
}

const RANKING_ORDER: Record<DashboardRanking, (a: RankingRow, b: RankingRow) => number> = {
  luot: (a, b) => b.visits - a.visits || b.km - a.km,
  'do-phu': (a, b) =>
    assignedCoverage(b) - assignedCoverage(a) ||
    b.assignedVisited - a.assignedVisited ||
    b.visits - a.visits,
  km: (a, b) => b.km - a.km || b.visits - a.visits,
};

async function periodFigures(
  scoped: ScopedDb,
  checkInScope: Prisma.CheckInWhereInput,
  dealerScope: Prisma.DealerWhereInput,
  range: { from: string; to: string },
): Promise<PeriodFigures> {
  const capturedAt = { gte: vietnamDayStart(range.from), lt: vietnamNextDayStart(range.to) };
  const [visits, covered] = await Promise.all([
    scoped.checkIn.count({ where: { ...checkInScope, capturedAt } }),
    scoped.dealer.count({ where: { ...dealerScope, checkIns: { some: { capturedAt } } } }),
  ]);
  return { ...range, visits, covered };
}

/**
 * Chỉ tiêu của phạm vi đang xem, cộng các tháng trong kỳ (K3, K4). Chọn một nhân viên: chỉ tiêu của người đó.
 * Chọn đơn vị: chỉ tiêu giao cho đơn vị, tháng chưa giao thì cộng chỉ tiêu nhân viên trong đơn vị. Không lọc:
 * cộng chỉ tiêu nhân viên trong phạm vi người xem.
 */
async function readTarget(
  scoped: ScopedDb,
  input: DashboardInput,
  unitIds: string[] | null,
  months: string[],
): Promise<DashboardResult['target']> {
  const members = await scoped.user.findMany({
    where: {
      isActive: true,
      roles: { some: { role: { permissions: { some: { code: 'sales.check-in.create' } } } } },
      ...(unitIds ? { orgUnitId: { in: unitIds } } : {}),
      ...(input.employeeCode ? { employeeCode: input.employeeCode } : {}),
    },
    select: { id: true },
  });
  const ids = members.map((member) => member.id);
  if (ids.length === 0) return null;
  const [userAssigned, unitAssigned, selfTargets] = await Promise.all([
    db.assignedSalesTarget.findMany({
      where: { kind: 'USER', userId: { in: ids }, month: { in: months } },
      select: { userId: true, month: true, visitCountTarget: true, dealerCoverageTarget: true },
    }),
    input.orgUnitId && !input.employeeCode
      ? db.assignedSalesTarget.findMany({
          where: { kind: 'UNIT', orgUnitId: input.orgUnitId, month: { in: months } },
          select: { month: true, visitCountTarget: true, dealerCoverageTarget: true },
        })
      : Promise.resolve([]),
    db.monthlySalesTarget.findMany({
      where: { userId: { in: ids }, month: { in: months }, approvedAt: { not: null } },
      select: { userId: true, month: true, approvedVisitCount: true, approvedDealerCoverage: true },
    }),
  ]);
  const key = (userId: string | null, month: string) => `${userId ?? ''}|${month}`;
  const assignedMap = new Map(userAssigned.map((row) => [key(row.userId, row.month), row]));
  const selfMap = new Map(
    selfTargets.map((row) => [
      key(row.userId, row.month),
      {
        visitCountTarget: row.approvedVisitCount ?? 0,
        dealerCoverageTarget: row.approvedDealerCoverage ?? 0,
      },
    ]),
  );
  const unitMap = new Map(unitAssigned.map((row) => [row.month, row]));

  let visitCountTarget = 0;
  let dealerCoverageTarget = 0;
  const sources = new Set<TargetSource>();
  for (const month of months) {
    const perUser = ids.map((id) =>
      effectiveUserTarget(
        assignedMap.get(key(id, month)) ?? null,
        selfMap.get(key(id, month)) ?? null,
      ),
    );
    const unit: TargetValues | null = unitMap.get(month) ?? null;
    const value =
      ids.length === 1 && input.employeeCode
        ? (perUser[0] ?? null)
        : effectiveUnitTarget(unit, perUser);
    if (!value) continue;
    visitCountTarget += value.visitCountTarget;
    dealerCoverageTarget += value.dealerCoverageTarget;
    sources.add(value.source);
  }
  if (sources.size === 0) return null;
  const source: TargetSource = sources.size === 1 ? ([...sources][0] ?? 'SUM') : 'SUM';
  return { visitCountTarget, dealerCoverageTarget, source, months };
}

/** Tỉ lệ hoàn thành tuyến (IA §3.5): điểm trong tuyến đã duyệt tới hôm nay có check-in đúng ngày đúng đại lý. */
async function readRouteCompletion(
  scoped: ScopedDb,
  input: DashboardInput,
  unitIds: string[] | null,
  today: string,
  geo: ProvinceFilter | null,
): Promise<DashboardResult['routes']> {
  const end = input.to < today ? input.to : today;
  if (end < input.from) return { planned: 0, visited: 0 };
  const plans = await scoped.routePlan.findMany({
    where: {
      approvedRevision: { not: null },
      // Tuyến tuần bắt đầu trước kỳ tối đa 6 ngày vẫn có ngày nằm trong kỳ.
      periodStart: { gte: shiftIso(input.from, -6), lte: end },
      ...(unitIds ? { orgUnitId: { in: unitIds } } : {}),
      ...(input.employeeCode ? { user: { employeeCode: input.employeeCode } } : {}),
    },
    select: {
      userId: true,
      approvedRevision: true,
      stops: {
        where: {
          day: { gte: input.from, lte: end },
          ...(geo ? { dealer: { provinceName: { in: geo.provinces } } } : {}),
        },
        select: { revision: true, day: true, dealerId: true },
      },
    },
  });
  const planned = plans.flatMap((plan) =>
    plan.stops
      .filter((stop) => stop.revision === plan.approvedRevision)
      .map((stop) => ({ userId: plan.userId, day: stop.day, dealerId: stop.dealerId })),
  );
  if (planned.length === 0) return { planned: 0, visited: 0 };
  const checkIns = await scoped.checkIn.findMany({
    where: {
      userId: { in: [...new Set(planned.map((stop) => stop.userId))] },
      dealerId: { not: null },
      capturedAt: { gte: vietnamDayStart(input.from), lt: vietnamNextDayStart(end) },
    },
    select: { userId: true, dealerId: true, capturedAt: true },
  });
  const done = new Set(
    checkIns.map((row) => `${row.userId}|${row.dealerId}|${vnDay(row.capturedAt)}`),
  );
  const visited = planned.filter((stop) =>
    done.has(`${stop.userId}|${stop.dealerId}|${stop.day}`),
  ).length;
  return { planned: planned.length, visited };
}

function shiftIso(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}
