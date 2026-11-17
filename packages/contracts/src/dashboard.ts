import { z } from 'zod';
import type { CheckInPlaceKind } from './check-ins';
import type { DealerLevel } from './dealers';
import { parseDisplayDate, vietnamToday } from './format';

// Dashboard check-in bản đầu (K0), IA §3. Chỉ phần không cần FAST; Thực bán và chỉ tiêu thêm ở K3a, K4.

export const DASHBOARD_PERIODS = [
  'hom-nay',
  '7-ngay',
  'thang-nay',
  'thang-truoc',
  'tuy-chon',
] as const;
export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];

export const DASHBOARD_PERIOD_LABEL: Record<DashboardPeriod, string> = {
  'hom-nay': 'Hôm nay',
  '7-ngay': '7 ngày qua',
  'thang-nay': 'Tháng này',
  'thang-truoc': 'Tháng trước',
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
};

const dateParam = z
  .string()
  .transform((value) => parseDisplayDate(value) ?? undefined)
  .optional()
  .catch(undefined);

function shiftDays(date: string, days: number): string {
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
    case 'thang-nay':
      return { from: monthStart, to: today };
  }
}

/** Đổi tham số tiếng Việt trên URL. Mặc định kỳ Tháng này (K0, duyệt 17/11/2026). */
export function dashboardUrlParams(now: Date = new Date()) {
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
    })
    .transform((url): DashboardInput => {
      const range = periodRange(url.ky, vietnamToday(now), {
        from: url['tu-ngay'],
        to: url['den-ngay'],
      });
      return {
        period: url.ky,
        ...range,
        orgUnitId: url['don-vi'] ?? null,
        employeeCode: url['nhan-vien'] || null,
        level: url.cap ?? null,
      };
    });
}

export type Coverage = { active: number; covered: number };

export type DashboardResult = {
  updatedAt: string;
  kpi: {
    visits: number;
    coverage: Coverage;
    staffCheckedInToday: number;
    staffTotal: number;
    gpsKm: number;
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
