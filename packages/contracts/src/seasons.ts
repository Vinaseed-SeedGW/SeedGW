import { z } from 'zod';
import { parseDisplayDate } from './format';

// Lịch vụ (K3, 23/11/2026): một lịch chung cho toàn công ty, Quản trị hệ thống khai báo. Dashboard và Báo cáo
// dùng vụ làm kỳ. Không tạo sẵn vụ nào: ngày vụ do Kinh doanh cung cấp.

export const MAX_SEASON_DAYS = 366;

const isoDate = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const parsed = parseDisplayDate(value);
    if (!parsed) {
      ctx.addIssue({ code: 'custom', message: 'Nhập ngày dạng dd/mm/yyyy' });
      return z.NEVER;
    }
    return parsed;
  });

/** Số ngày từ ngày bắt đầu tới ngày kết thúc, tính cả hai đầu. */
export function seasonDays(startDate: string, endDate: string): number {
  return Math.round((Date.parse(endDate) - Date.parse(startDate)) / 86_400_000) + 1;
}

export const upsertSeasonInput = z
  .object({
    id: z.uuid().nullable(),
    name: z.string().trim().min(1, 'Nhập tên vụ').max(100, 'Tên vụ tối đa 100 ký tự'),
    startDate: isoDate,
    endDate: isoDate,
    note: z.string().trim().max(500, 'Ghi chú tối đa 500 ký tự'),
  })
  .superRefine((value, ctx) => {
    const days = seasonDays(value.startDate, value.endDate);
    if (days < 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: 'Ngày kết thúc phải sau ngày bắt đầu',
      });
    } else if (days > MAX_SEASON_DAYS) {
      ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'Một vụ dài tối đa 366 ngày' });
    }
  });
export type UpsertSeasonInput = z.infer<typeof upsertSeasonInput>;

export const deleteSeasonInput = z.object({ id: z.uuid() });

export const seasonRow = z.object({
  id: z.uuid(),
  name: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  days: z.number().int(),
  note: z.string(),
});
export type SeasonRow = z.infer<typeof seasonRow>;

/** Vụ chứa ngày đang xét, ưu tiên vụ bắt đầu muộn nhất khi các vụ chồng nhau. */
export function seasonOn<T extends { startDate: string; endDate: string }>(
  seasons: readonly T[],
  day: string,
): T | null {
  let found: T | null = null;
  for (const season of seasons) {
    if (season.startDate <= day && day <= season.endDate) {
      if (!found || season.startDate > found.startDate) found = season;
    }
  }
  return found;
}
