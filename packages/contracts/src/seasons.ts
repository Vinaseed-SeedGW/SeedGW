import { z } from 'zod';

// Lịch vụ (K3, đổi 23/11/2026): mỗi vụ khai báo ngày, tháng bắt đầu và kết thúc, lặp lại mọi năm. Kết thúc
// đứng trước bắt đầu trong năm (ví dụ 05/11 tới 15/03) là vụ sang năm sau. Một lịch chung toàn công ty,
// vùng tạm ghi trong tên vụ (ví dụ "Đông Xuân, ĐBSCL").

export type SeasonDates = {
  startDay: number;
  startMonth: number;
  endDay: number;
  endMonth: number;
};
export type SeasonRow = SeasonDates & {
  id: string;
  name: string;
  // K7: vụ của một vùng canh tác; null là vụ chung, chọn được ở mọi vùng.
  regionId: string | null;
  regionName: string | null;
  days: number;
  crossesYear: boolean;
  note: string;
};

// Năm không nhuận làm mốc tính số ngày; 29/02 không dùng được vì năm thường không có.
const REFERENCE_YEAR = 2001;
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** "05/11" hoặc "5/11" thành ngày, tháng; sai thì null. */
export function parseDayMonth(text: string): { day: number; month: number } | null {
  const match = /^(\d{1,2})\/(\d{1,2})$/.exec(text.trim());
  if (!match?.[1] || !match[2]) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const max = DAYS_IN_MONTH[month - 1];
  return max !== undefined && day >= 1 && day <= max ? { day, month } : null;
}

export function formatDayMonth(day: number, month: number): string {
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
}

export function crossesYear(season: SeasonDates): boolean {
  return season.endMonth * 100 + season.endDay < season.startMonth * 100 + season.startDay;
}

/** Số ngày của vụ, tính cả hai đầu. */
export function seasonDays(season: SeasonDates): number {
  const start = Date.UTC(REFERENCE_YEAR, season.startMonth - 1, season.startDay);
  const end = Date.UTC(
    REFERENCE_YEAR + (crossesYear(season) ? 1 : 0),
    season.endMonth - 1,
    season.endDay,
  );
  return Math.round((end - start) / 86_400_000) + 1;
}

function isoOf(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Khoảng ngày của vụ bắt đầu trong năm startYear. */
export function seasonOccurrence(
  season: SeasonDates,
  startYear: number,
): { from: string; to: string } {
  return {
    from: isoOf(startYear, season.startMonth, season.startDay),
    to: isoOf(startYear + (crossesYear(season) ? 1 : 0), season.endMonth, season.endDay),
  };
}

/** Năm bắt đầu của lần gần nhất đã bắt đầu tính tới hôm nay (yyyy-MM-dd). */
export function latestStartYear(season: SeasonDates, today: string): number {
  const year = Number(today.slice(0, 4));
  return seasonOccurrence(season, year).from <= today ? year : year - 1;
}

/** Niên vụ hiện trên giao diện: vụ sang năm là "2026-2027", trong năm là "2027". */
export function seasonYearLabel(season: SeasonDates, startYear: number): string {
  return crossesYear(season) ? `${startYear}-${startYear + 1}` : String(startYear);
}

/** Số niên vụ chọn được trên Dashboard, Báo cáo: lần gần nhất và 2 lần trước. */
export const SEASON_YEARS_SHOWN = 3;

export function seasonYearOptions(season: SeasonDates, today: string): number[] {
  const latest = latestStartYear(season, today);
  return Array.from({ length: SEASON_YEARS_SHOWN }, (_, index) => latest - index);
}

/** Vụ đang diễn ra hôm nay; nhiều vụ chồng nhau thì lấy vụ bắt đầu muộn nhất. */
export function activeSeason<T extends SeasonDates>(
  seasons: readonly T[],
  today: string,
): T | null {
  let found: { season: T; from: string } | null = null;
  for (const season of seasons) {
    const range = seasonOccurrence(season, latestStartYear(season, today));
    if (range.from <= today && today <= range.to && (!found || range.from > found.from)) {
      found = { season, from: range.from };
    }
  }
  return found?.season ?? null;
}

const dayMonthField = (label: string) =>
  z
    .string()
    .trim()
    .transform((value, ctx) => {
      const parsed = parseDayMonth(value);
      if (!parsed) {
        ctx.addIssue({
          code: 'custom',
          message: `${label} dạng dd/mm, ví dụ 05/11 (không dùng 29/02)`,
        });
        return z.NEVER;
      }
      return parsed;
    });

/** Form trên web: chỉ kiểm tra, giữ dạng chữ dd/mm; máy chủ đổi sang ngày, tháng bằng upsertSeasonInput. */
const dayMonthText = (label: string) =>
  z
    .string()
    .trim()
    .refine((value) => parseDayMonth(value) !== null, {
      message: `${label} dạng dd/mm, ví dụ 05/11 (không dùng 29/02)`,
    });

const regionField = z.uuid().nullable();

export const seasonFormInput = z.object({
  id: z.uuid().nullable(),
  name: z.string().trim().min(1, 'Nhập tên vụ').max(100, 'Tên vụ tối đa 100 ký tự'),
  regionId: z.uuid().nullable(),
  start: dayMonthText('Ngày bắt đầu'),
  end: dayMonthText('Ngày kết thúc'),
  note: z.string().trim().max(500, 'Ghi chú tối đa 500 ký tự'),
});

export const upsertSeasonInput = z
  .object({
    id: z.uuid().nullable(),
    name: z.string().trim().min(1, 'Nhập tên vụ').max(100, 'Tên vụ tối đa 100 ký tự'),
    regionId: regionField,
    start: dayMonthField('Ngày bắt đầu'),
    end: dayMonthField('Ngày kết thúc'),
    note: z.string().trim().max(500, 'Ghi chú tối đa 500 ký tự'),
  })
  .transform((value) => ({
    id: value.id,
    name: value.name,
    regionId: value.regionId,
    startDay: value.start.day,
    startMonth: value.start.month,
    endDay: value.end.day,
    endMonth: value.end.month,
    note: value.note,
  }));
export type UpsertSeasonInput = z.infer<typeof upsertSeasonInput>;

export const deleteSeasonInput = z.object({ id: z.uuid() });

/** "05/11 tới 15/03 năm sau". */
export function seasonRangeText(season: SeasonDates): string {
  return `${formatDayMonth(season.startDay, season.startMonth)} tới ${formatDayMonth(season.endDay, season.endMonth)}${crossesYear(season) ? ' năm sau' : ''}`;
}
