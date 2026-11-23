import { z } from 'zod';
import { dashboardUrlParams, type DashboardInput, type SeasonRange } from './dashboard';
import type { DealerLevel } from './dealers';

// Báo cáo Kinh doanh (K5, 23/11/2026): bảng số theo nhân viên, đơn vị hoặc đại lý trong kỳ, xuất Excel theo phạm vi.
// Chưa có Thực bán (làm khi nối FAST). Kỳ và bộ lọc dùng chung với Dashboard.

export const REPORT_GROUPS = ['nhan-vien', 'don-vi', 'dai-ly'] as const;
export type ReportGroup = (typeof REPORT_GROUPS)[number];

export const REPORT_GROUP_LABEL: Record<ReportGroup, string> = {
  'nhan-vien': 'Theo nhân viên',
  'don-vi': 'Theo đơn vị',
  'dai-ly': 'Theo đại lý',
};

export const REPORT_PAGE_SIZE = 50;
/** Xuất Excel theo đại lý tối đa bằng số đại lý trong danh mục hiện nay, có dư. */
export const MAX_REPORT_EXPORT_ROWS = 30_000;

export type ReportInput = DashboardInput & { group: ReportGroup; page: number; pageSize: number };

export function reportUrlParams(now: Date = new Date(), seasons: readonly SeasonRange[] = []) {
  const extra = z.object({
    theo: z.enum(REPORT_GROUPS).catch('nhan-vien'),
    trang: z.coerce.number().int().positive().max(1_000_000).catch(1),
  });
  return z.record(z.string(), z.unknown()).transform((raw): ReportInput => {
    const base = dashboardUrlParams(now, seasons).parse(raw);
    const { theo, trang } = extra.parse(raw);
    return { ...base, group: theo, page: trang, pageSize: REPORT_PAGE_SIZE };
  });
}

export type ReportTarget = { visitCountTarget: number; dealerCoverageTarget: number };

export type StaffReportRow = {
  code: string;
  name: string;
  orgUnitName: string | null;
  visits: number;
  dealersVisited: number;
  // Đại lý đang hoạt động được giao cho nhân viên, và số đại lý đó đã được ghé trong kỳ.
  assignedDealers: number;
  assignedVisited: number;
  km: number;
  target: ReportTarget | null;
  routePlanned: number;
  routeVisited: number;
};

export type UnitReportRow = {
  id: string;
  code: string;
  name: string;
  visits: number;
  dealersVisited: number;
  activeDealers: number;
  km: number;
  target: ReportTarget | null;
};

export type DealerReportRow = {
  id: string;
  code: string | null;
  name: string;
  level: DealerLevel;
  orgUnitName: string | null;
  assignedUserName: string | null;
  visits: number;
  lastVisitedAt: string | null;
};

export type ReportResult =
  | { group: 'nhan-vien'; rows: StaffReportRow[]; targetMonths: string[] | null }
  | { group: 'don-vi'; rows: UnitReportRow[]; targetMonths: string[] | null }
  | { group: 'dai-ly'; rows: DealerReportRow[]; total: number; page: number; pageSize: number };

/** % làm tròn một số lẻ, null khi mẫu bằng 0. */
export function ratioPercent(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return Math.round((part / whole) * 1000) / 10;
}
