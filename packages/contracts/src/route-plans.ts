import { z } from 'zod';
import { approvalStatus } from './approvals';
import { pageResult } from './common';

// S8 (duyệt 17/11/2026): tuyến tuần gồm từng ngày thứ Hai đến thứ Bảy; tối đa 30 điểm mỗi ngày.
export const routeKind = z.enum(['WEEKLY', 'DAILY']);
export type RouteKind = z.infer<typeof routeKind>;

export const ROUTE_KIND_LABEL: Record<RouteKind, string> = {
  WEEKLY: 'Theo tuần',
  DAILY: 'Theo ngày',
};

export const ROUTE_KIND_OPTIONS = (Object.keys(ROUTE_KIND_LABEL) as RouteKind[]).map((value) => ({
  value,
  label: ROUTE_KIND_LABEL[value],
}));

export const ROUTE_KIND_HINT =
  'Nhân viên trong đơn vị đăng ký tuyến theo tuần (thứ Hai đến thứ Bảy) hoặc theo từng ngày trên app.';

export const MAX_STOPS_PER_DAY = 30;
export const ROUTE_WEEK_LENGTH = 6;
/** Tuyến ngày đăng ký được từ hôm nay tới 7 ngày tới. */
export const DAILY_ROUTE_DAYS_AHEAD = 7;

const DAY_MS = 86_400_000;
const VN_OFFSET_MS = 7 * 3_600_000;

// Tự viết thay vì dùng ./format để app điện thoại không phải nạp Intl khi chỉ cần ngày tháng.
function isoDateToDisplay(day: string): string {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  return iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : day;
}

function vietnamToday(now: Date): string {
  return new Date(now.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
}

function vietnamDayStart(day: string): Date {
  return new Date(Date.parse(`${day}T00:00:00Z`) - VN_OFFSET_MS);
}

const SHORT_WEEKDAY = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

/** Nhãn ngắn cho nút chọn ngày, ví dụ T2 23/11. */
export function formatRouteDayShort(day: string): string {
  return `${SHORT_WEEKDAY[weekdayOf(day)] ?? ''} ${isoDateToDisplay(day).slice(0, 5)}`;
}
const WEEKDAY_LABEL = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

export const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không đúng định dạng');

export function addDays(day: string, delta: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + delta * DAY_MS).toISOString().slice(0, 10);
}

/** 0 là Chủ nhật, 1 là thứ Hai. */
export function weekdayOf(day: string): number {
  return new Date(`${day}T00:00:00Z`).getUTCDay();
}

export function mondayOf(day: string): string {
  const weekday = weekdayOf(day);
  return addDays(day, weekday === 0 ? -6 : 1 - weekday);
}

export function routePeriodDays(kind: RouteKind, periodStart: string): string[] {
  if (kind === 'DAILY') return [periodStart];
  return Array.from({ length: ROUTE_WEEK_LENGTH }, (_, index) => addDays(periodStart, index));
}

export function formatRouteDay(day: string): string {
  return `${WEEKDAY_LABEL[weekdayOf(day)] ?? ''} ${isoDateToDisplay(day)}`;
}

export function formatRoutePeriod(kind: RouteKind, periodStart: string): string {
  if (kind === 'DAILY') return `Ngày ${formatRouteDay(periodStart)}`;
  const end = addDays(periodStart, ROUTE_WEEK_LENGTH - 1);
  return `Tuần ${isoDateToDisplay(periodStart).slice(0, 5)} đến ${isoDateToDisplay(end)}`;
}

/** Kỳ đăng ký hoặc sửa được: tuần này và tuần sau; hoặc hôm nay tới 7 ngày tới. Kỳ đã qua chỉ xem. */
export function editableRoutePeriods(kind: RouteKind, now = new Date()): string[] {
  const today = vietnamToday(now);
  if (kind === 'WEEKLY') {
    const monday = mondayOf(today);
    return [monday, addDays(monday, 7)];
  }
  return Array.from({ length: DAILY_ROUTE_DAYS_AHEAD + 1 }, (_, index) => addDays(today, index));
}

export function isValidPeriodStart(kind: RouteKind, periodStart: string): boolean {
  return kind === 'DAILY' || weekdayOf(periodStart) === 1;
}

/** Hạn nộp: tuyến tuần trước giờ đặt ở Tham số ngày thứ Sáu tuần trước; tuyến ngày trước giờ đó hôm trước. */
export function routeDeadline(
  kind: RouteKind,
  periodStart: string,
  hours: { weekly: number; daily: number },
): Date {
  const day = addDays(periodStart, kind === 'WEEKLY' ? -3 : -1);
  const hour = kind === 'WEEKLY' ? hours.weekly : hours.daily;
  return new Date(vietnamDayStart(day).getTime() + hour * 3_600_000);
}

export const submitRoutePlanInput = z
  .object({
    kind: routeKind,
    periodStart: isoDay,
    days: z
      .array(
        z.object({
          day: isoDay,
          dealerIds: z
            .array(z.uuid())
            .max(MAX_STOPS_PER_DAY, `Tối đa ${MAX_STOPS_PER_DAY} điểm mỗi ngày`),
        }),
      )
      .min(1)
      .max(ROUTE_WEEK_LENGTH),
    note: z.string().trim().max(500, 'Ghi chú tối đa 500 ký tự'),
  })
  .superRefine((input, ctx) => {
    if (!isValidPeriodStart(input.kind, input.periodStart)) {
      ctx.addIssue({
        code: 'custom',
        path: ['periodStart'],
        message: 'Tuyến tuần bắt đầu từ thứ Hai',
      });
      return;
    }
    const allowed = new Set(routePeriodDays(input.kind, input.periodStart));
    let total = 0;
    for (const day of input.days) {
      if (!allowed.has(day.day)) {
        ctx.addIssue({ code: 'custom', path: ['days'], message: 'Có ngày nằm ngoài kỳ đăng ký' });
        return;
      }
      if (new Set(day.dealerIds).size !== day.dealerIds.length) {
        ctx.addIssue({
          code: 'custom',
          path: ['days'],
          message: `${formatRouteDay(day.day)} có đại lý bị chọn trùng`,
        });
        return;
      }
      total += day.dealerIds.length;
    }
    if (total === 0) {
      ctx.addIssue({ code: 'custom', path: ['days'], message: 'Chọn ít nhất một đại lý' });
    }
  });
export type SubmitRoutePlanInput = z.infer<typeof submitRoutePlanInput>;

export const routeStopView = z.object({
  dealerId: z.uuid(),
  dealerName: z.string(),
  dealerCode: z.string().nullable(),
  address: z.string(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  visited: z.boolean(),
});
export type RouteStopView = z.infer<typeof routeStopView>;

export const routeDayView = z.object({
  day: isoDay,
  label: z.string(),
  stops: z.array(routeStopView),
});
export type RouteDayView = z.infer<typeof routeDayView>;

export const routeCompletion = z.object({
  visited: z.number().int().nonnegative(),
  planned: z.number().int().nonnegative(),
});
export type RouteCompletion = z.infer<typeof routeCompletion>;

export const routePlanView = z.object({
  id: z.uuid(),
  kind: routeKind,
  periodStart: isoDay,
  periodLabel: z.string(),
  note: z.string(),
  proposed: z.array(routeDayView),
  approved: z.array(routeDayView).nullable(),
  approvedAt: z.iso.datetime().nullable(),
  approvalCode: z.string().nullable(),
  approvalStatus: approvalStatus.nullable(),
  isLate: z.boolean(),
  returnReason: z.string().nullable(),
  canWithdraw: z.boolean(),
  /** Tính trên tuyến đã duyệt, các ngày tới hôm nay. */
  completion: routeCompletion.nullable(),
});
export type RoutePlanView = z.infer<typeof routePlanView>;

export const myRoutePeriod = z.object({
  kind: routeKind,
  periodStart: isoDay,
  periodLabel: z.string(),
  days: z.array(isoDay),
  deadline: z.iso.datetime(),
  pastDeadline: z.boolean(),
  editable: z.boolean(),
  plan: routePlanView.nullable(),
});
export type MyRoutePeriod = z.infer<typeof myRoutePeriod>;

export const todayRoute = z.object({
  day: isoDay,
  label: z.string(),
  approvalCode: z.string().nullable(),
  stops: z.array(routeStopView),
});
export type TodayRoute = z.infer<typeof todayRoute>;

export const myRoutesResult = z.object({
  /** Kiểu tuyến của đơn vị hiện tại. */
  kind: routeKind,
  canRegister: z.boolean(),
  today: todayRoute.nullable(),
  periods: z.array(myRoutePeriod),
});
export type MyRoutesResult = z.infer<typeof myRoutesResult>;

export const routePlanRow = z.object({
  id: z.uuid(),
  userName: z.string(),
  userCode: z.string(),
  orgUnitName: z.string().nullable(),
  kind: routeKind,
  periodStart: isoDay,
  periodLabel: z.string(),
  stopCount: z.number().int().nonnegative(),
  completion: routeCompletion.nullable(),
  approvalCode: z.string().nullable(),
  approvalStatus: approvalStatus.nullable(),
  isLate: z.boolean(),
});
export type RoutePlanRow = z.infer<typeof routePlanRow>;

export const listRoutePlansResult = pageResult(routePlanRow);
export type ListRoutePlansResult = z.infer<typeof listRoutePlansResult>;

export const ROUTE_TABS = ['cua-toi', 'pham-vi'] as const;
export type RouteTab = (typeof ROUTE_TABS)[number];
export const ROUTE_PAGE_SIZE = 20;

export const routesUrlParams = z
  .object({
    tab: z.enum(ROUTE_TABS).catch('cua-toi'),
    tuan: isoDay.optional().catch(undefined),
    q: z.string().trim().max(100).optional().catch(undefined),
    trang: z.coerce.number().int().positive().max(1_000_000).catch(1),
  })
  .transform((url) => ({
    tab: url.tab,
    week: url.tuan ? mondayOf(url.tuan) : undefined,
    q: url.q || undefined,
    page: url.trang,
    pageSize: ROUTE_PAGE_SIZE,
  }));
export type ListRoutePlansInput = z.infer<typeof routesUrlParams>;

export const routePlanDetail = routePlanView.extend({
  userName: z.string(),
  userCode: z.string(),
  orgUnitName: z.string().nullable(),
});
export type RoutePlanDetail = z.infer<typeof routePlanDetail>;

/** Phần tuyến trên trang chi tiết phiếu duyệt. */
export const routeApprovalView = z.object({
  kind: routeKind,
  periodLabel: z.string(),
  proposed: z.array(routeDayView),
  approved: z.array(routeDayView).nullable(),
});
export type RouteApprovalView = z.infer<typeof routeApprovalView>;

export function countStops(days: readonly { stops: readonly unknown[] }[]): number {
  return days.reduce((sum, day) => sum + day.stops.length, 0);
}

/** Điểm có toạ độ dùng lat,lng; chưa có toạ độ dùng địa chỉ (Google Maps tự tìm). */
export function mapsPlace(
  stop: Pick<RouteStopView, 'lat' | 'lng' | 'address' | 'dealerName'>,
): string {
  if (stop.lat !== null && stop.lng !== null) return `${stop.lat},${stop.lng}`;
  return stop.address.trim() || stop.dealerName;
}

export const MAPS_POINTS_PER_LINK = 10;

/**
 * Đường dẫn Chỉ đường Google Maps theo đúng thứ tự, mỗi đường dẫn khoảng 10 điểm. Đoạn đầu đi từ vị trí
 * hiện tại (Google Maps tự lấy), đoạn sau đi tiếp từ điểm cuối của đoạn trước.
 */
export function mapsDirectionLinks(
  stops: readonly Pick<RouteStopView, 'lat' | 'lng' | 'address' | 'dealerName'>[],
): Array<{ from: number; to: number; url: string }> {
  const links: Array<{ from: number; to: number; url: string }> = [];
  for (let start = 0; start < stops.length; start += MAPS_POINTS_PER_LINK) {
    const chunk = stops.slice(start, start + MAPS_POINTS_PER_LINK);
    const destination = chunk[chunk.length - 1];
    if (!destination) continue;
    const params = new URLSearchParams({ api: '1', travelmode: 'driving' });
    const previous = start > 0 ? stops[start - 1] : undefined;
    if (previous) params.set('origin', mapsPlace(previous));
    params.set('destination', mapsPlace(destination));
    const waypoints = chunk.slice(0, -1).map(mapsPlace);
    if (waypoints.length > 0) params.set('waypoints', waypoints.join('|'));
    links.push({
      from: start + 1,
      to: start + chunk.length,
      url: `https://www.google.com/maps/dir/?${params.toString()}`,
    });
  }
  return links;
}

/** Sắp theo điểm gần nhất kế tiếp (đường chim bay, chưa có máy chủ tìm đường). Chưa có toạ độ thì xếp cuối. */
export function sortByNearest<T extends { lat: number | null; lng: number | null }>(
  stops: readonly T[],
  start: { lat: number; lng: number } | null,
): T[] {
  const located = stops.filter((stop) => stop.lat !== null && stop.lng !== null);
  const unlocated = stops.filter((stop) => stop.lat === null || stop.lng === null);
  const result: T[] = [];
  const remaining = [...located];
  let cursor =
    start ?? (remaining[0] ? { lat: remaining[0].lat ?? 0, lng: remaining[0].lng ?? 0 } : null);
  while (remaining.length > 0 && cursor) {
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    remaining.forEach((stop, index) => {
      const distance = squaredDistance(cursor ?? { lat: 0, lng: 0 }, {
        lat: stop.lat ?? 0,
        lng: stop.lng ?? 0,
      });
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });
    const [next] = remaining.splice(bestIndex, 1);
    if (!next) break;
    result.push(next);
    cursor = { lat: next.lat ?? 0, lng: next.lng ?? 0 };
  }
  return [...result, ...unlocated];
}

// Khoảng cách tương đối đủ để so gần xa trong một tỉnh, hiệu chỉnh kinh độ theo vĩ độ.
function squaredDistance(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = a.lat - b.lat;
  const dLng = (a.lng - b.lng) * Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180));
  return dLat * dLat + dLng * dLng;
}
