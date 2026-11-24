import { z } from 'zod';
import type { CheckInPlaceKind } from './check-ins';
import type { DealerLevel } from './dealers';
import { parseDisplayDate, vietnamToday } from './format';
import type { ProvinceName } from './provinces';
import { provinceFromSlug } from './regions';
import {
  activeSeason,
  latestStartYear,
  seasonOccurrence,
  seasonYearLabel,
  SEASON_YEARS_SHOWN,
  type SeasonDates,
} from './seasons';
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

/** Xếp hạng nhân viên (K4c, IA §3.2): theo lượt ghé thăm, độ phủ đại lý phụ trách hoặc km. */
export const DASHBOARD_RANKINGS = ['luot', 'do-phu', 'km'] as const;
export type DashboardRanking = (typeof DASHBOARD_RANKINGS)[number];

export const DASHBOARD_RANKING_LABEL: Record<DashboardRanking, string> = {
  luot: 'Lượt ghé thăm',
  'do-phu': 'Độ phủ đại lý phụ trách',
  km: 'Km',
};

export type DashboardInput = {
  period: DashboardPeriod;
  from: string;
  to: string;
  orgUnitId: string | null;
  employeeCode: string | null;
  level: DealerLevel | null;
  // Kỳ Vụ (K4): vụ đang chọn trong Lịch vụ và năm bắt đầu của niên vụ.
  seasonId: string | null;
  seasonYear: number | null;
  // K7: vùng canh tác và tỉnh, lọc theo tỉnh của đại lý.
  regionId: string | null;
  provinceName: ProvinceName | null;
  rankBy: DashboardRanking;
};

export type SeasonRange = SeasonDates & { id: string; name: string; regionId: string | null };

/** Vụ chọn được khi lọc vùng: vụ của vùng và vụ chưa gắn vùng; không lọc vùng thì mọi vụ. */
export function seasonsForRegion<T extends { regionId: string | null }>(
  seasons: readonly T[],
  regionId: string | null,
): T[] {
  if (!regionId) return [...seasons];
  return seasons.filter((season) => season.regionId === null || season.regionId === regionId);
}

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
export function dashboardUrlParams(
  now: Date = new Date(),
  seasons: readonly SeasonRange[] = [],
  provinces: ReadonlyArray<{ name: ProvinceName; regionId: string | null }> = [],
) {
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
      'nien-vu': z.coerce.number().int().min(2000).max(2100).optional().catch(undefined),
      'sap-xep': z.enum(DASHBOARD_RANKINGS).catch('luot'),
      vung: z.uuid().optional().catch(undefined),
      tinh: z
        .string()
        .transform((value) => provinceFromSlug(value) ?? undefined)
        .optional()
        .catch(undefined),
    })
    .transform((url): DashboardInput => {
      const today = vietnamToday(now);
      // Tỉnh không thuộc vùng đang chọn thì bỏ; chỉ chọn tỉnh thì vụ lấy theo vùng của tỉnh.
      const regionOf = (name: ProvinceName) =>
        provinces.find((row) => row.name === name)?.regionId ?? null;
      const regionId = url.vung ?? null;
      const provinceName =
        url.tinh && (!regionId || regionOf(url.tinh) === regionId) ? url.tinh : null;
      const seasonRegion = regionId ?? (provinceName ? regionOf(provinceName) : null);
      const choices = seasonsForRegion(seasons, seasonRegion);
      // Vụ: vụ đã chọn, không có thì vụ đang diễn ra, rồi tới vụ đầu danh sách. Niên vụ mặc định là lần
      // gần nhất đã bắt đầu; chỉ chọn được lần đó và 2 lần trước.
      const season =
        url.ky === 'vu'
          ? (choices.find((item) => item.id === url.vu) ??
            activeSeason(choices, today) ??
            choices[0] ??
            null)
          : null;
      const latest = season ? latestStartYear(season, today) : null;
      const seasonYear =
        season && latest !== null
          ? url['nien-vu'] !== undefined &&
            url['nien-vu'] <= latest &&
            url['nien-vu'] > latest - SEASON_YEARS_SHOWN
            ? url['nien-vu']
            : latest
          : null;
      const period = url.ky === 'vu' && !season ? 'thang-nay' : url.ky;
      const range = periodRange(
        period,
        today,
        season && seasonYear !== null
          ? seasonOccurrence(season, seasonYear)
          : { from: url['tu-ngay'], to: url['den-ngay'] },
      );
      return {
        period,
        ...range,
        seasonId: season?.id ?? null,
        seasonYear,
        orgUnitId: url['don-vi'] ?? null,
        employeeCode: url['nhan-vien'] || null,
        level: url.cap ?? null,
        regionId,
        provinceName,
        rankBy: url['sap-xep'],
      };
    });
}

/**
 * Biểu đồ lượt ghé thăm (K4c): kỳ tới 31 ngày vẽ theo ngày, tới 186 ngày (Quý, Vụ) theo tuần bắt đầu thứ Hai,
 * dài hơn theo tháng, để kỳ Năm không thành vài trăm cột.
 */
export type ChartBucket = 'day' | 'week' | 'month';

export function chartBucket(from: string, to: string): ChartBucket {
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
  if (days <= 31) return 'day';
  if (days <= 186) return 'week';
  return 'month';
}

/** Ngày đầu nhóm chứa ngày này; nhóm đầu kỳ không lùi quá ngày bắt đầu kỳ. */
export function bucketStart(day: string, bucket: ChartBucket, from: string): string {
  let start = day;
  if (bucket === 'week') {
    const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
    start = shiftDays(day, -((weekday + 6) % 7));
  } else if (bucket === 'month') {
    start = `${day.slice(0, 7)}-01`;
  }
  return start < from ? from : start;
}

/** Nhãn trục: ngày 05/11, tuần ghi ngày đầu tuần 02/11, tháng 11/2026. */
export function bucketLabel(start: string, bucket: ChartBucket): string {
  const [year, month, day] = start.split('-');
  return bucket === 'month' ? `${month}/${year}` : `${day}/${month}`;
}

/** Gộp số lượt theo ngày thành chuỗi cột của kỳ (K1, K4c); ngày không có lượt vẫn có cột bằng 0. */
export function bucketSeries(
  from: string,
  to: string,
  daily: ReadonlyArray<{ day: string; visits: number }>,
): { bucket: ChartBucket; series: { start: string; visits: number }[] } {
  const bucket = chartBucket(from, to);
  const counts = new Map<string, number>();
  for (let day = from; day <= to; day = shiftDays(day, 1)) {
    counts.set(bucketStart(day, bucket, from), 0);
  }
  for (const row of daily) {
    if (row.day < from || row.day > to) continue;
    const key = bucketStart(row.day, bucket, from);
    counts.set(key, (counts.get(key) ?? 0) + row.visits);
  }
  return { bucket, series: [...counts].map(([start, visits]) => ({ start, visits })) };
}

export const CHART_BUCKET_TITLE: Record<ChartBucket, string> = {
  day: 'Lượt ghé thăm theo ngày',
  week: 'Lượt ghé thăm theo tuần',
  month: 'Lượt ghé thăm theo tháng',
};

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
    // K4c: gộp theo ngày, tuần hoặc tháng tuỳ độ dài kỳ.
    bucket: ChartBucket;
    series: { start: string; visits: number }[];
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
      // Đại lý được giao cho nhân viên đã được ghé trong kỳ, để tính độ phủ đại lý phụ trách.
      assignedVisited: number;
      km: number;
    }[];
    notCheckedInToday: { code: string; name: string; orgUnitName: string | null }[];
    notCheckedInTotal: number;
  } | null;
};

/** Tên kỳ trên tiêu đề: kỳ Vụ ghi tên vụ và niên vụ, ví dụ "Vụ Đông Xuân, ĐBSCL 2026-2027". */
export function periodTitle(input: DashboardInput, seasons: readonly SeasonRange[]): string {
  if (input.period === 'vu' && input.seasonId && input.seasonYear !== null) {
    const season = seasons.find((item) => item.id === input.seasonId);
    if (season) return `Vụ ${season.name} ${seasonYearLabel(season, input.seasonYear)}`;
  }
  return DASHBOARD_PERIOD_LABEL[input.period];
}
