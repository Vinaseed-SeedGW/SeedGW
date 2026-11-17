import { z } from 'zod';
import { approvalStatus } from './approvals';
import { pageResult } from './common';

export const salesTargetMonth = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Chọn tháng đúng định dạng');

// Khong dung .default() de kieu vao va ra cua form giong nhau (React Hook Form).
export const upsertSalesTargetInput = z.object({
  month: salesTargetMonth,
  visitCountTarget: z.coerce
    .number<number>({ error: 'Nhập số lượt ghé thăm' })
    .int('Nhập số nguyên')
    .min(1, 'Số lượt ghé thăm phải lớn hơn 0')
    .max(10_000, 'Tối đa 10.000 lượt'),
  dealerCoverageTarget: z.coerce
    .number<number>({ error: 'Nhập số đại lý được ghé' })
    .int('Nhập số nguyên')
    .min(1, 'Số đại lý được ghé phải lớn hơn 0')
    .max(10_000, 'Tối đa 10.000 đại lý'),
  salesKgTarget: z.coerce
    .number<number>({ error: 'Nhập sản lượng Thực bán (kg)' })
    .nonnegative('Sản lượng phải từ 0 trở lên')
    .max(10_000_000, 'Sản lượng quá lớn'),
  note: z.string().trim().max(500, 'Ghi chú tối đa 500 ký tự'),
});
export type UpsertSalesTargetInput = z.infer<typeof upsertSalesTargetInput>;

export const salesTargetSnapshot = z.object({
  month: salesTargetMonth,
  visitCountTarget: z.number().int().nonnegative(),
  dealerCoverageTarget: z.number().int().nonnegative(),
  salesKgTarget: z.number().nonnegative(),
  note: z.string(),
});
export type SalesTargetSnapshot = z.infer<typeof salesTargetSnapshot>;

/** Chỉ tiêu đang hiệu lực (đã duyệt). Bản sửa đang chờ duyệt không thay bản này. */
export const approvedTargetValues = z.object({
  visitCountTarget: z.number().int().nonnegative(),
  dealerCoverageTarget: z.number().int().nonnegative(),
  salesKgTarget: z.number().nonnegative(),
  approvedAt: z.iso.datetime(),
});
export type ApprovedTargetValues = z.infer<typeof approvedTargetValues>;

/** Kết quả thực tế trong tháng, tính từ check-in. Thực bán có khi nối FAST. */
export const targetProgress = z.object({
  visitCount: z.number().int().nonnegative(),
  dealerCoverage: z.number().int().nonnegative(),
});
export type TargetProgress = z.infer<typeof targetProgress>;

export const myTargetMonth = z.object({
  month: salesTargetMonth,
  monthLabel: z.string(),
  editable: z.boolean(),
  target: z
    .object({
      proposed: salesTargetSnapshot,
      approved: approvedTargetValues.nullable(),
      approvalCode: z.string().nullable(),
      approvalStatus: approvalStatus.nullable(),
      returnReason: z.string().nullable(),
      canWithdraw: z.boolean(),
    })
    .nullable(),
  progress: targetProgress,
});
export type MyTargetMonth = z.infer<typeof myTargetMonth>;

export const myTargetsResult = z.object({ months: z.array(myTargetMonth) });
export type MyTargetsResult = z.infer<typeof myTargetsResult>;

export const salesTargetRow = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  userName: z.string(),
  userCode: z.string(),
  orgUnitName: z.string().nullable(),
  month: salesTargetMonth,
  proposed: salesTargetSnapshot,
  approved: approvedTargetValues.nullable(),
  approvalCode: z.string().nullable(),
  approvalStatus: approvalStatus.nullable(),
  progress: targetProgress,
});
export type SalesTargetRow = z.infer<typeof salesTargetRow>;

export const listSalesTargetsResult = pageResult(salesTargetRow);
export type ListSalesTargetsResult = z.infer<typeof listSalesTargetsResult>;

export const SALES_TARGET_TABS = ['cua-toi', 'pham-vi'] as const;
export type SalesTargetTab = (typeof SALES_TARGET_TABS)[number];
export const SALES_TARGET_PAGE_SIZE = 20;

export const salesTargetsUrlParams = z
  .object({
    tab: z.enum(SALES_TARGET_TABS).catch('cua-toi'),
    thang: salesTargetMonth.optional().catch(undefined),
    q: z.string().trim().max(100).optional().catch(undefined),
    trang: z.coerce.number().int().positive().max(1_000_000).catch(1),
  })
  .transform((url) => ({
    tab: url.tab,
    month: url.thang,
    q: url.q || undefined,
    page: url.trang,
    pageSize: SALES_TARGET_PAGE_SIZE,
  }));
export type ListSalesTargetsInput = z.infer<typeof salesTargetsUrlParams>;

/** Phần chỉ tiêu trên trang chi tiết phiếu duyệt: bản đề nghị so với bản đang hiệu lực. */
export const salesTargetApprovalView = z.object({
  proposed: salesTargetSnapshot,
  approved: approvedTargetValues.nullable(),
  progress: targetProgress,
});
export type SalesTargetApprovalView = z.infer<typeof salesTargetApprovalView>;

/** Phần trăm hoàn thành làm tròn số nguyên; null khi chưa có chỉ tiêu. */
export function targetPercent(actual: number, target: number | null | undefined): number | null {
  if (!target || target <= 0) return null;
  return Math.round((actual / target) * 100);
}

export function currentVnMonth(now = Date.now()): string {
  const vn = new Date(now + 7 * 3_600_000);
  const year = vn.getUTCFullYear();
  const month = String(vn.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split('-').map(Number);
  return new Date(Date.UTC(year ?? 1970, (m ?? 1) - 1 + delta, 1)).toISOString().slice(0, 7);
}

/** Tháng được đăng ký hoặc sửa: tháng này và tháng sau (duyệt 17/11/2026). Tháng đã qua chỉ xem. */
export function editableTargetMonths(now = Date.now()): [string, string] {
  const current = currentVnMonth(now);
  return [current, shiftMonth(current, 1)];
}

export function isEditableTargetMonth(month: string, now = Date.now()): boolean {
  return editableTargetMonths(now).includes(month);
}

export function formatMonthLabel(month: string): string {
  const [year, m] = month.split('-');
  if (!year || !m) return month;
  return `Tháng ${Number(m)}/${year}`;
}

export function monthBoundsUtc(month: string): { start: Date; end: Date } {
  const [yearStr, monthStr] = month.split('-');
  const year = Number(yearStr);
  const m = Number(monthStr);
  // 00:00:00 giờ VN (UTC+7) của ngày đầu tháng -> cuối ngày cuối tháng.
  const start = new Date(Date.UTC(year, m - 1, 1, -7, 0, 0, 0));
  const end = new Date(Date.UTC(year, m, 1, -7, 0, 0, 0) - 1);
  return { start, end };
}
