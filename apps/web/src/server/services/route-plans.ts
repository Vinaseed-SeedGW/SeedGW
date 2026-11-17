import 'server-only';
import type { Prisma } from '@prisma/client';
import type { ApprovalStatus } from '@dms/contracts/approvals';
import { auditChanges, type AuditChanges } from '@dms/contracts/audit';
import { vietnamDayStart, vietnamNextDayStart, vietnamToday } from '@dms/contracts/format';
import {
  addDays,
  editableRoutePeriods,
  formatRouteDay,
  formatRoutePeriod,
  mondayOf,
  routeDeadline,
  routePeriodDays,
  ROUTE_KIND_LABEL,
  type ListRoutePlansInput,
  type ListRoutePlansResult,
  type MyRoutePeriod,
  type MyRoutesResult,
  type RouteApprovalView,
  type RouteCompletion,
  type RouteDayView,
  type RouteKind,
  type RoutePlanDetail,
  type RoutePlanView,
  type SubmitRoutePlanInput,
  type TodayRoute,
  ROUTE_DEALER_SEARCH_LIMIT,
  type RouteDealerOption,
} from '@dms/contracts/route-plans';
import { escapeLikePattern, normalizeSearchText } from '@dms/contracts/text';
import { db } from '@dms/db/client';
import type { ScopedDb } from '@dms/db/scoped-client';
import { applyApproved, isUniqueViolation, isWithdrawable, submitApproval } from './approvals';
import { DomainError } from './domain-error';
import { readSystemSettings } from './settings';

// Kỳ đã qua hiện thêm 4 tuyến gần nhất để xem lại.
const PAST_PLANS_SHOWN = 4;

export type RoutePlanOutcome = {
  planId: string;
  requestId: string;
  code: string;
  periodLabel: string;
  status: ApprovalStatus;
  selfApproved: boolean;
  isLate: boolean;
  created: boolean;
  changes: AuditChanges;
};

async function deadlineHours() {
  const settings = await readSystemSettings();
  return {
    weekly: settings.values.routeWeeklyDeadlineHour,
    daily: settings.values.routeDailyDeadlineHour,
  };
}

async function unitRouteKind(
  userId: string,
): Promise<{ kind: RouteKind; orgUnitId: string | null }> {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { orgUnitId: true, orgUnit: { select: { routeKind: true } } },
  });
  return { kind: user.orgUnit?.routeKind ?? 'WEEKLY', orgUnitId: user.orgUnitId };
}

/**
 * Đăng ký hoặc sửa tuyến của chính mình rồi gửi duyệt (S8). Mỗi lần gửi tạo bản điểm mới; tuyến đã duyệt
 * giữ hiệu lực đến khi bản sửa được duyệt. Đại lý phải nằm trong phạm vi dữ liệu của người đăng ký.
 * Nộp sau hạn vẫn nhận, phiếu gắn nhãn Nộp muộn.
 */
export async function submitRoutePlan(
  userId: string,
  scoped: ScopedDb,
  input: SubmitRoutePlanInput,
  now = new Date(),
  actorId = userId,
): Promise<RoutePlanOutcome> {
  const [{ kind, orgUnitId }, hours] = await Promise.all([unitRouteKind(userId), deadlineHours()]);
  if (input.kind !== kind) {
    throw new DomainError(
      'VALIDATION',
      `Đơn vị của bạn đang dùng tuyến ${ROUTE_KIND_LABEL[kind].toLowerCase()}, tải lại để đăng ký đúng kiểu`,
    );
  }
  if (!editableRoutePeriods(kind, now).includes(input.periodStart)) {
    throw new DomainError(
      'VALIDATION',
      kind === 'WEEKLY'
        ? 'Chỉ đăng ký hoặc sửa được tuyến tuần này và tuần sau'
        : 'Chỉ đăng ký hoặc sửa được tuyến từ hôm nay tới 7 ngày tới',
    );
  }

  const dealerIds = [...new Set(input.days.flatMap((day) => day.dealerIds))];
  const found = await scoped.dealer.findMany({
    where: { id: { in: dealerIds }, status: 'ACTIVE' },
    select: { id: true },
  });
  if (found.length !== dealerIds.length) {
    throw new DomainError(
      'VALIDATION',
      'Có đại lý ngoài phạm vi phụ trách hoặc đã ngừng hoạt động, tải lại danh sách và chọn lại',
    );
  }

  const days = routePeriodDays(kind, input.periodStart);
  const deadline = routeDeadline(kind, input.periodStart, hours);
  const isLate = now.getTime() > deadline.getTime();
  const periodLabel = formatRoutePeriod(kind, input.periodStart);
  const lastDay = days[days.length - 1] ?? input.periodStart;
  const total = input.days.reduce((sum, day) => sum + day.dealerIds.length, 0);
  const activeDays = input.days.filter((day) => day.dealerIds.length > 0).length;

  try {
    return await db.$transaction(async (tx) => {
      const existing = await tx.routePlan.findUnique({
        where: { userId_kind_periodStart: { userId, kind, periodStart: input.periodStart } },
        select: { id: true, currentRevision: true, approvedRevision: true, note: true },
      });
      const previousCount = existing
        ? await tx.routePlanStop.count({
            where: { planId: existing.id, revision: existing.currentRevision },
          })
        : 0;
      const plan = existing
        ? await tx.routePlan.update({
            where: { id: existing.id },
            data: { note: input.note, orgUnitId, currentRevision: existing.currentRevision + 1 },
            select: { id: true, currentRevision: true, approvedRevision: true },
          })
        : await tx.routePlan.create({
            data: {
              userId,
              orgUnitId,
              kind,
              periodStart: input.periodStart,
              note: input.note,
              currentRevision: 1,
            },
            select: { id: true, currentRevision: true, approvedRevision: true },
          });

      // Giữ bản đã duyệt và bản vừa gửi, bỏ các bản bị trả lại hoặc rút lại trước đó.
      await tx.routePlanStop.deleteMany({
        where: {
          planId: plan.id,
          revision: {
            notIn: [
              plan.currentRevision,
              ...(plan.approvedRevision ? [plan.approvedRevision] : []),
            ],
          },
        },
      });
      await tx.routePlanStop.createMany({
        data: input.days.flatMap((day) =>
          day.dealerIds.map((dealerId, position) => ({
            planId: plan.id,
            revision: plan.currentRevision,
            day: day.day,
            position,
            dealerId,
          })),
        ),
      });

      const submitted = await submitApproval(tx, {
        kind: 'ROUTE_PLAN',
        subjectId: plan.id,
        submitterId: userId,
        periodStart: vietnamDayStart(input.periodStart),
        periodEnd: new Date(vietnamNextDayStart(lastDay).getTime() - 1),
        periodLabel,
        summaryText: `${total} điểm trong ${activeDays} ngày`,
        isLate,
        snapshot: { kind, periodStart: input.periodStart, days: input.days, note: input.note },
        now,
        actorId,
      });
      if (submitted.selfApproved) await applyApproved(tx, 'ROUTE_PLAN', plan.id, now);

      return {
        planId: plan.id,
        requestId: submitted.requestId,
        code: submitted.code,
        periodLabel,
        status: submitted.status,
        selfApproved: submitted.selfApproved,
        isLate,
        created: !existing,
        changes: auditChanges(
          existing
            ? { period: periodLabel, stops: previousCount, note: existing.note || null }
            : {},
          { period: periodLabel, stops: total, note: input.note || null },
        ),
      };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new DomainError('CONFLICT', 'Tuyến kỳ này vừa được gửi, vui lòng tải lại');
    }
    throw error;
  }
}

// ---------- Dựng dữ liệu hiển thị ----------

const PLAN_SELECT = {
  id: true,
  userId: true,
  kind: true,
  periodStart: true,
  note: true,
  currentRevision: true,
  approvedRevision: true,
  approvedAt: true,
} satisfies Prisma.RoutePlanSelect;

type PlanRecord = Prisma.RoutePlanGetPayload<{ select: typeof PLAN_SELECT }>;

type StopRecord = {
  planId: string;
  revision: number;
  day: string;
  position: number;
  dealer: {
    id: string;
    name: string;
    code: string | null;
    legacyCode: string | null;
    address: string;
    lat: number | null;
    lng: number | null;
  };
};

/** Điểm đã ghé: chủ tuyến có check-in tại đại lý đó trong đúng ngày (giờ Việt Nam). */
async function visitedKeys(
  plans: readonly PlanRecord[],
  stops: readonly StopRecord[],
): Promise<Set<string>> {
  const keys = new Set<string>();
  if (stops.length === 0) return keys;
  const owners = new Map(plans.map((plan) => [plan.id, plan.userId]));
  const daysSorted = stops.map((stop) => stop.day).sort();
  const first = daysSorted[0] ?? vietnamToday();
  const last = daysSorted[daysSorted.length - 1] ?? first;
  const rows = await db.checkIn.findMany({
    where: {
      userId: { in: [...new Set(owners.values())] },
      dealerId: { in: [...new Set(stops.map((stop) => stop.dealer.id))] },
      capturedAt: { gte: vietnamDayStart(first), lt: vietnamNextDayStart(last) },
    },
    select: { userId: true, dealerId: true, capturedAt: true },
  });
  for (const row of rows) keys.add(`${row.userId}|${row.dealerId}|${vietnamToday(row.capturedAt)}`);
  return keys;
}

async function loadStops(plans: readonly PlanRecord[]): Promise<StopRecord[]> {
  if (plans.length === 0) return [];
  return db.routePlanStop.findMany({
    where: {
      OR: plans.map((plan) => ({
        planId: plan.id,
        revision: {
          in: [plan.currentRevision, ...(plan.approvedRevision ? [plan.approvedRevision] : [])],
        },
      })),
    },
    orderBy: [{ day: 'asc' }, { position: 'asc' }],
    select: {
      planId: true,
      revision: true,
      day: true,
      position: true,
      dealer: {
        select: {
          id: true,
          name: true,
          code: true,
          legacyCode: true,
          address: true,
          lat: true,
          lng: true,
        },
      },
    },
  });
}

function dayViews(
  plan: PlanRecord,
  revision: number,
  stops: readonly StopRecord[],
  visited: ReadonlySet<string>,
): RouteDayView[] {
  return routePeriodDays(plan.kind, plan.periodStart).map((day) => ({
    day,
    label: formatRouteDay(day),
    stops: stops
      .filter((stop) => stop.planId === plan.id && stop.revision === revision && stop.day === day)
      .map((stop) => ({
        dealerId: stop.dealer.id,
        dealerName: stop.dealer.name,
        dealerCode: stop.dealer.code ?? stop.dealer.legacyCode,
        address: stop.dealer.address,
        lat: stop.dealer.lat,
        lng: stop.dealer.lng,
        visited: visited.has(`${plan.userId}|${stop.dealer.id}|${day}`),
      })),
  }));
}

function completionOf(days: readonly RouteDayView[] | null, today: string): RouteCompletion | null {
  if (!days) return null;
  let planned = 0;
  let visited = 0;
  for (const day of days) {
    if (day.day > today) continue;
    planned += day.stops.length;
    visited += day.stops.filter((stop) => stop.visited).length;
  }
  return { planned, visited };
}

async function requestsFor(planIds: readonly string[]) {
  const rows = await db.approvalRequest.findMany({
    where: { kind: 'ROUTE_PLAN', subjectId: { in: [...planIds] } },
    select: {
      subjectId: true,
      code: true,
      status: true,
      isLate: true,
      managerApproverId: true,
      actions: {
        where: { action: 'RETURN' },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { note: true },
      },
    },
  });
  return new Map(rows.map((row) => [row.subjectId, row]));
}

async function buildViews(
  plans: readonly PlanRecord[],
  now: Date,
): Promise<Map<string, RoutePlanView>> {
  const stops = await loadStops(plans);
  const [visited, requests] = await Promise.all([
    visitedKeys(plans, stops),
    requestsFor(plans.map((plan) => plan.id)),
  ]);
  const today = vietnamToday(now);
  const views = new Map<string, RoutePlanView>();
  for (const plan of plans) {
    const request = requests.get(plan.id);
    const approved =
      plan.approvedRevision !== null ? dayViews(plan, plan.approvedRevision, stops, visited) : null;
    views.set(plan.id, {
      id: plan.id,
      kind: plan.kind,
      periodStart: plan.periodStart,
      periodLabel: formatRoutePeriod(plan.kind, plan.periodStart),
      note: plan.note,
      proposed: dayViews(plan, plan.currentRevision, stops, visited),
      approved,
      approvedAt: plan.approvedAt?.toISOString() ?? null,
      approvalCode: request?.code ?? null,
      approvalStatus: request?.status ?? null,
      isLate: request?.isLate ?? false,
      returnReason: request?.status === 'RETURNED' ? (request.actions[0]?.note ?? null) : null,
      canWithdraw: request ? isWithdrawable(request.status, request.managerApproverId) : false,
      completion: completionOf(approved, today),
    });
  }
  return views;
}

/** Tuyến của chính mình: các kỳ đăng ký được, tuyến đã qua gần nhất và tuyến đã duyệt hôm nay. */
export async function readMyRoutes(
  userId: string,
  canRegister: boolean,
  now = new Date(),
): Promise<MyRoutesResult> {
  const [{ kind }, hours] = await Promise.all([unitRouteKind(userId), deadlineHours()]);
  const today = vietnamToday(now);
  const editable = editableRoutePeriods(kind, now);
  const [current, past, todayPlans] = await Promise.all([
    db.routePlan.findMany({
      where: { userId, kind, periodStart: { in: editable } },
      select: PLAN_SELECT,
    }),
    db.routePlan.findMany({
      where: { userId, periodStart: { lt: kind === 'WEEKLY' ? (editable[0] ?? today) : today } },
      orderBy: { periodStart: 'desc' },
      take: PAST_PLANS_SHOWN,
      select: PLAN_SELECT,
    }),
    // Tuyến ngày của hôm nay được ưu tiên hơn tuyến tuần có hôm nay.
    db.routePlan.findMany({
      where: {
        userId,
        approvedRevision: { not: null },
        OR: [
          { kind: 'DAILY', periodStart: today },
          { kind: 'WEEKLY', periodStart: mondayOf(today) },
        ],
      },
      select: PLAN_SELECT,
    }),
  ]);
  const all = [...new Map([...current, ...past, ...todayPlans].map((p) => [p.id, p])).values()];
  const views = await buildViews(all, now);
  const byPeriod = new Map(current.map((plan) => [plan.periodStart, plan]));

  const period = (
    plan: PlanRecord | undefined,
    periodKind: RouteKind,
    start: string,
    isEditable: boolean,
  ): MyRoutePeriod => {
    const deadline = routeDeadline(periodKind, start, hours);
    return {
      kind: periodKind,
      periodStart: start,
      periodLabel: formatRoutePeriod(periodKind, start),
      days: routePeriodDays(periodKind, start),
      deadline: deadline.toISOString(),
      pastDeadline: now.getTime() > deadline.getTime(),
      editable: canRegister && isEditable,
      plan: plan ? (views.get(plan.id) ?? null) : null,
    };
  };

  const todayPlan =
    todayPlans.find((plan) => plan.kind === 'DAILY') ?? todayPlans.find((p) => p.kind === 'WEEKLY');
  const todayView = todayPlan ? views.get(todayPlan.id) : undefined;
  const todayDay = todayView?.approved?.find((day) => day.day === today);
  const todayRoute: TodayRoute | null =
    todayView && todayDay && todayDay.stops.length > 0
      ? {
          day: today,
          label: formatRouteDay(today),
          approvalCode: todayView.approvalCode,
          stops: todayDay.stops,
        }
      : null;

  return {
    kind,
    canRegister,
    today: todayRoute,
    periods: [
      ...editable.map((start) => period(byPeriod.get(start), kind, start, true)),
      ...past.map((plan) => period(plan, plan.kind, plan.periodStart, false)),
    ],
  };
}

/** Tuyến của nhân viên trong phạm vi của người xem, theo tuần (mặc định tuần này). */
export async function listScopeRoutes(
  scoped: ScopedDb,
  input: ListRoutePlansInput,
  now = new Date(),
): Promise<ListRoutePlansResult & { week: string }> {
  const week = input.week ?? mondayOf(vietnamToday(now));
  const q = input.q?.trim();
  const where: Prisma.RoutePlanWhereInput = {
    OR: [
      { kind: 'WEEKLY', periodStart: week },
      { kind: 'DAILY', periodStart: { gte: week, lte: addDays(week, 6) } },
    ],
    ...(q
      ? {
          AND: [
            {
              OR: [
                { user: { fullName: { contains: q, mode: 'insensitive' } } },
                { user: { employeeCode: { contains: q, mode: 'insensitive' } } },
              ],
            },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    scoped.routePlan.findMany({
      where,
      orderBy: [{ user: { fullName: 'asc' } }, { periodStart: 'asc' }, { id: 'asc' }],
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
      select: {
        ...PLAN_SELECT,
        user: { select: { fullName: true, employeeCode: true } },
        orgUnit: { select: { name: true } },
      },
    }),
    scoped.routePlan.count({ where }),
  ]);
  const views = await buildViews(rows, now);
  return {
    week,
    items: rows.map((row) => {
      const view = views.get(row.id);
      const days = view?.approved ?? view?.proposed ?? [];
      return {
        id: row.id,
        userName: row.user.fullName,
        userCode: row.user.employeeCode,
        orgUnitName: row.orgUnit?.name ?? null,
        kind: row.kind,
        periodStart: row.periodStart,
        periodLabel: formatRoutePeriod(row.kind, row.periodStart),
        stopCount: days.reduce((sum, day) => sum + day.stops.length, 0),
        completion: view?.completion ?? null,
        approvalCode: view?.approvalCode ?? null,
        approvalStatus: view?.approvalStatus ?? null,
        isLate: view?.isLate ?? false,
      };
    }),
    total,
    page: input.page,
    pageSize: input.pageSize,
  };
}

/** Chi tiết một tuyến trong phạm vi dữ liệu của người xem; null khi không có hoặc ngoài phạm vi. */
export async function readRouteDetail(
  scoped: ScopedDb,
  id: string,
  now = new Date(),
): Promise<RoutePlanDetail | null> {
  const plan = await scoped.routePlan.findFirst({
    where: { id },
    select: {
      ...PLAN_SELECT,
      user: { select: { fullName: true, employeeCode: true } },
      orgUnit: { select: { name: true } },
    },
  });
  if (!plan) return null;
  const view = (await buildViews([plan], now)).get(plan.id);
  if (!view) return null;
  return {
    ...view,
    userName: plan.user.fullName,
    userCode: plan.user.employeeCode,
    orgUnitName: plan.orgUnit?.name ?? null,
  };
}

/** Phần tuyến trên trang chi tiết phiếu (người xem đã được kiểm quyền xem phiếu trước đó). */
export async function readRouteApprovalView(
  planId: string,
  now = new Date(),
): Promise<RouteApprovalView | null> {
  const plan = await db.routePlan.findUnique({ where: { id: planId }, select: PLAN_SELECT });
  if (!plan) return null;
  const view = (await buildViews([plan], now)).get(plan.id);
  if (!view) return null;
  return {
    kind: view.kind,
    periodLabel: view.periodLabel,
    proposed: view.proposed,
    approved:
      view.approved && plan.approvedRevision !== plan.currentRevision ? view.approved : null,
  };
}

/** Tìm đại lý đang hoạt động trong phạm vi của người bấm, tìm không dấu theo tên, mã, số điện thoại. */
export async function searchRouteDealers(
  scoped: ScopedDb,
  q: string,
): Promise<RouteDealerOption[]> {
  const search = normalizeSearchText(q);
  const rows = await scoped.dealer.findMany({
    where: {
      status: 'ACTIVE',
      ...(search ? { searchText: { contains: escapeLikePattern(search) } } : {}),
    },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    take: ROUTE_DEALER_SEARCH_LIMIT,
    select: {
      id: true,
      name: true,
      code: true,
      legacyCode: true,
      address: true,
      lat: true,
      lng: true,
    },
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    code: row.code ?? row.legacyCode,
    address: row.address,
    lat: row.lat,
    lng: row.lng,
  }));
}
