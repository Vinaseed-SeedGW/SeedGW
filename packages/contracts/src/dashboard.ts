import { z } from 'zod';
import type { CheckInPlaceKind } from './check-ins';
import type { DealerLevel } from './dealers';
import { parseDisplayDate, vietnamToday } from './format';
import type { TargetSource } from './target-assignments';

// Dashboard check-in bản đầu (K0), IA §3. Chỉ phần không cần FAST; Thực bán và chỉ tiêu thêm ở K3a, K4.

export const DASHBOARD_PERIODS = [
  'hom-nay',
  '7-ngay',
  'tuan-nay',
  'thang-nay',
  'thang-truoc',
  'quy-nay',
  'vu',
  'nam-nay',
  'tuy-chon',
] as const;
export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];

export const DASHBOARD_PERIOD_LABEL: Record<DashboardPeriod, string> = {
  'hom-nay': 'Hôm nay',
  '7-ngay': '7 ngày qua',
  'tuan-nay': 'Tuần này',
  'thang-nay': 'Tháng này',
  'thang-truoc': 'Tháng trước',
  'quy-nay': 'Quý này',
  vu: 'Vụ',
  'nam-nay': 'Năm nay',
  'tuy-chon': 'Tuỳ chọn',
};

// Kỳ tuỳ chọn dài nhất, để biểu đồ theo ngày và truy vấn không quá nặng khi chưa có bảng tổng hợp (K1).
export const MAX_DASHBOARD_DAYS = 366;

export type DashboardInput = {
  period: DashboardPeriod;
  from: string;
  to: string;
  orgUnitId: string | null;
  employeeCode: string | null;
  level: DealerLevel | null;
  // Kỳ Vụ (K4): vụ đang chọn trong Lịch vụ.
  seasonId: string | null;
};

export type SeasonRange = { id: string; name: string; startDate: string; endDate: string };

const dateParam = z
  .string()
  .transform((value) => parseDisplayDate(value) ?? undefined)
  .optional()
  .catch(undefined);

export function shiftDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** Khoảng ngày của kỳ, tính theo giờ Việt Nam. */
export function periodRange(
  period: DashboardPeriod,
  today: string,
  custom: { from?: string; to?: string } = {},
): { from: string; to: string } {
  const monthStart = `${today.slice(0, 7)}-01`;
  switch (period) {
    case 'hom-nay':
      return { from: today, to: today };
    case '7-ngay':
      return { from: shiftDays(today, -6), to: today };
    case 'thang-truoc': {
      const lastDay = shiftDays(monthStart, -1);
      return { from: `${lastDay.slice(0, 7)}-01`, to: lastDay };
    }
    case 'tuy-chon': {
      const to = custom.to && custom.to <= today ? custom.to : today;
      let from = custom.from ?? monthStart;
      if (from > to) from = to;
      const earliest = shiftDays(to, -(MAX_DASHBOARD_DAYS - 1));
      return { from: from < earliest ? earliest : from, to };
    }
    case 'tuan-nay': {
      // Tuần tính từ thứ Hai.
      const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
      return { from: shiftDays(today, -((weekday + 6) % 7)), to: today };
    }
    case 'quy-nay': {
      const month = Number(today.slice(5, 7));
      const first = String(Math.floor((month - 1) / 3) * 3 + 1).padStart(2, '0');
      return { from: `${today.slice(0, 4)}-${first}-01`, to: today };
    }
    case 'nam-nay':
      return { from: `${today.slice(0, 4)}-01-01`, to: today };
    case 'vu': {
      // Vụ chưa tới thì lấy ngày bắt đầu; vụ đang diễn ra dừng ở hôm nay.
      const from = custom.from ?? monthStart;
      const end = custom.to ?? today;
      const to = end <= today ? end : today;
      return { from: from <= to ? from : to, to };
    }
    case 'thang-nay':
      return { from: monthStart, to: today };
  }
}

/** Kỳ liền trước cùng số ngày, để so sánh. */
export function previousRange(from: string, to: string): { from: string; to: string } {
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
  return { from: shiftDays(from, -days), to: shiftDays(from, -1) };
}

function minusYear(date: string): string {
  const year = Number(date.slice(0, 4)) - 1;
  const rest = date.slice(4);
  // 29/2 năm nhuận lùi về 28/2.
  return rest === '-02-29' ? `${year}-02-28` : `${year}${rest}`;
}

/** Cùng kỳ năm trước. */
export function lastYearRange(from: string, to: string): { from: string; to: string } {
  return { from: minusYear(from), to: minusYear(to) };
}

/** Kỳ tính theo tháng thì so được với chỉ tiêu tháng (cộng chỉ tiêu các tháng trong kỳ). */
export const MONTHLY_PERIODS: readonly DashboardPeriod[] = [
  'thang-nay',
  'thang-truoc',
  'quy-nay',
  'vu',
  'nam-nay',
];

/** Các tháng (yyyy-MM) có ngày nằm trong kỳ. */
export function monthsInRange(from: string, to: string): string[] {
  const months: string[] = [];
  let year = Number(from.slice(0, 4));
  let month = Number(from.slice(5, 7));
  const endKey = to.slice(0, 7);
  for (let guard = 0; guard < 24; guard += 1) {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    months.push(key);
    if (key >= endKey) break;
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

/** Đổi tham số tiếng Việt trên URL. Mặc định kỳ Tháng này (K0, duyệt 17/11/2026). */
export function dashboardUrlParams(now: Date = new Date(), seasons: readonly SeasonRange[] = []) {
  return z
    .object({
      ky: z.enum(DASHBOARD_PERIODS).catch('thang-nay'),
      'tu-ngay': dateParam,
      'den-ngay': dateParam,
      'don-vi': z.uuid().optional().catch(undefined),
      'nhan-vien': z.string().trim().max(50).optional().catch(undefined),
      cap: z.coerce
        .number()
        .pipe(z.union([z.literal(1), z.literal(2), z.literal(3)]))
        .optional()
        .catch(undefined),
      vu: z.uuid().optional().catch(undefined),
    })
    .transform((url): DashboardInput => {
      const today = vietnamToday(now);
      // Vụ: vụ đã chọn, không có thì vụ đang diễn ra, rồi tới vụ gần nhất đã bắt đầu.
      const season =
        url.ky === 'vu'
          ? (seasons.find((item) => item.id === url.vu) ??
            seasons.find((item) => item.startDate <= today && today <= item.endDate) ??
            seasons.find((item) => item.startDate <= today) ??
            null)
          : null;
      const period = url.ky === 'vu' && !season ? 'thang-nay' : url.ky;
      const range = periodRange(
        period,
        today,
        season
          ? { from: season.startDate, to: season.endDate }
          : { from: url['tu-ngay'], to: url['den-ngay'] },
      );
      return {
        period,
        ...range,
        seasonId: season?.id ?? null,
        orgUnitId: url['don-vi'] ?? null,
        employeeCode: url['nhan-vien'] || null,
        level: url.cap ?? null,
      };
    });
}

export type Coverage = { active: number; covered: number };

/** Nguồn của số km: toàn bộ theo đường đi, toàn bộ theo GPS, hay có lượt chưa tính xong dùng km GPS. */
export type KmSource = { roadVisits: number; gpsVisits: number };

export function kmSourceNote(source: KmSource): string {
  if (source.roadVisits === 0) return 'Theo GPS, chưa có km theo đường đi';
  if (source.gpsVisits === 0) return 'Theo đường đi thực tế';
  return `Theo đường đi; ${source.gpsVisits} lượt chưa tính xong dùng km GPS`;
}

/** Lượt ghé thăm và số đại lý được ghé của một kỳ, để so sánh (K4). */
export type PeriodFigures = { from: string; to: string; visits: number; covered: number };

/** % thay đổi so với kỳ so sánh; null khi kỳ so sánh bằng 0. */
export function changePercent(current: number, base: number): number | null {
  if (base <= 0) return null;
  return Math.round(((current - base) / base) * 100);
}

export type DashboardResult = {
  updatedAt: string;
  // K4 (23/11/2026): so kỳ trước và cùng kỳ năm trước, chỉ tiêu, tuyến, đại lý mới. Chưa có Thực bán.
  compare: { previous: PeriodFigures; lastYear: PeriodFigures };
  // Cộng chỉ tiêu các tháng trong kỳ; null khi kỳ không tính theo tháng hoặc chưa có chỉ tiêu.
  target: {
    visitCountTarget: number;
    dealerCoverageTarget: number;
    source: TargetSource;
    months: string[];
  } | null;
  // Điểm trong tuyến đã duyệt tới hôm nay và số điểm đã check-in đúng ngày.
  routes: { planned: number; visited: number };
  // Đại lý mới duyệt từ đề xuất trên app (M10) trong kỳ.
  newDealers: number;
  kpi: {
    visits: number;
    coverage: Coverage;
    staffCheckedInToday: number;
    staffTotal: number;
    // V1b: km theo đường đi khi máy chủ đã tính, lượt chưa tính lấy km theo GPS.
    km: number;
    kmSource: KmSource;
  };
  market: {
    perDay: { day: string; visits: number }[];
    byKind: Record<CheckInPlaceKind, number>;
    kmPerVisit: number | null;
    flagged: number;
  };
  dealers: {
    overdueByLevel: Record<DealerLevel, number>;
    overdueDays: Record<DealerLevel, number>;
    neverVisited: number;
    missingLocation: number;
    unassigned: number;
    overdueList: {
      id: string;
      name: string;
      level: DealerLevel;
      assignedUserName: string | null;
      lastVisitedAt: string;
      days: number;
    }[];
    coverageByLevel: (Coverage & { level: DealerLevel })[];
    coverageByUnit: (Coverage & { unitName: string })[];
  };
  // Chỉ có khi người xem quản lý từ hai người trở lên (Quản trị đơn vị, Quản trị hệ thống).
  staff: {
    ranking: {
      code: string;
      name: string;
      orgUnitName: string | null;
      visits: number;
      coveredDealers: number;
      assignedDealers: number;
      km: number;
    }[];
    notCheckedInToday: { code: string; name: string; orgUnitName: string | null }[];
    notCheckedInTotal: number;
  } | null;
};
