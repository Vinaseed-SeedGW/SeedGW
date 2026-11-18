import 'server-only';
import type { Prisma } from '@prisma/client';
import type { CheckInPlaceKind } from '@dms/contracts/check-ins';
import type { DashboardInput, DashboardResult } from '@dms/contracts/dashboard';
import type { DealerLevel } from '@dms/contracts/dealers';
import { vietnamDayStart, vietnamNextDayStart, vietnamToday } from '@dms/contracts/format';
import { db } from '@dms/db/client';
import { getOrgUnitTreeIds } from '@dms/db/org-units';
import { getScopedDb } from '@/server/auth/scoped-db';
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

function eachDay(from: string, to: string): string[] {
  const days: string[] = [];
  for (
    let at = Date.parse(`${from}T00:00:00Z`);
    at <= Date.parse(`${to}T00:00:00Z`);
    at += DAY_MS
  ) {
    days.push(new Date(at).toISOString().slice(0, 10));
  }
  return days;
}

/**
 * Số liệu dashboard check-in (K0). Mọi truy vấn qua client có phạm vi dữ liệu của người xem; bộ lọc đơn vị
 * gồm cả đơn vị con. Tính thẳng từ dữ liệu gốc, bảng tổng hợp theo ngày làm ở K1.
 */
export async function readDashboard(
  input: DashboardInput,
  showStaff: boolean,
  now = new Date(),
): Promise<DashboardResult> {
  const [scoped, settings, unitIds] = await Promise.all([
    getScopedDb(),
    readSystemSettings(),
    input.orgUnitId ? getOrgUnitTreeIds(input.orgUnitId) : Promise.resolve(null),
  ]);
  const from = vietnamDayStart(input.from);
  const to = vietnamNextDayStart(input.to);
  const today = vietnamToday(now);

  const checkInScope: Prisma.CheckInWhereInput = {
    ...(unitIds ? { orgUnitId: { in: unitIds } } : {}),
    ...(input.employeeCode ? { user: { employeeCode: input.employeeCode } } : {}),
  };
  const inPeriod: Prisma.CheckInWhereInput = { ...checkInScope, capturedAt: { gte: from, lt: to } };
  const dealerScope: Prisma.DealerWhereInput = {
    status: 'ACTIVE',
    ...(input.level ? { level: input.level } : {}),
    ...(unitIds ? { orgUnitId: { in: unitIds } } : {}),
    ...(input.employeeCode ? { assignedUser: { employeeCode: input.employeeCode } } : {}),
  };
  const visitedInPeriod: Prisma.DealerWhereInput = {
    ...dealerScope,
    checkIns: { some: { capturedAt: { gte: from, lt: to } } },
  };
  const staffScope: Prisma.UserWhereInput = {
    isActive: true,
    roles: { some: { role: { code: FIELD_STAFF_ROLE } } },
    ...(unitIds ? { orgUnitId: { in: unitIds } } : {}),
    ...(input.employeeCode ? { employeeCode: input.employeeCode } : {}),
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
    capturedDays,
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
    scoped.checkIn.findMany({ where: inPeriod, select: { capturedAt: true } }),
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

  const perDayCounts = new Map<string, number>();
  for (const row of capturedDays) {
    const day = vnDay(row.capturedAt);
    perDayCounts.set(day, (perDayCounts.get(day) ?? 0) + 1);
  }
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
  const coveredLevel = new Map(coveredByLevel.map((row) => [row.level, row._count._all]));

  return {
    updatedAt: now.toISOString(),
    kpi: {
      visits,
      coverage: { active: activeDealers, covered: coveredDealers },
      staffCheckedInToday: todayUsers.length,
      staffTotal,
      km,
      kmSource: { roadVisits: roadSum._count._all, gpsVisits: gpsFallbackVisits },
    },
    market: {
      perDay: eachDay(input.from, input.to).map((day) => ({
        day,
        visits: perDayCounts.get(day) ?? 0,
      })),
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
    staff: showStaff ? await readStaff(staffScope, inPeriod, checkInScope, today) : null,
  };
}

async function readStaff(
  staffScope: Prisma.UserWhereInput,
  inPeriod: Prisma.CheckInWhereInput,
  checkInScope: Prisma.CheckInWhereInput,
  today: string,
): Promise<DashboardResult['staff']> {
  const scoped = await getScopedDb();
  const [perUser, perUserRoad, perUserGps, perUserDealer, assigned, staff, todayUsers] =
    await Promise.all([
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
        where: { status: 'ACTIVE', assignedUserId: { not: null } },
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
      km: round3(kmByUser.get(user.id) ?? 0),
    }))
    .filter((row) => row.visits > 0)
    .sort((a, b) => b.visits - a.visits || b.km - a.km)
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
