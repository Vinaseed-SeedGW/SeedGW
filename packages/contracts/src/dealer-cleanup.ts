import { z } from 'zod';
import { pageResult } from './common';
import { normalizeVnPhone } from './dealers';

// ---------- Số điện thoại sai dạng (A7b) ----------

export const phoneIssueKind = z.enum(['JUNK', 'SHORT', 'LONG', 'OTHER']);
export type PhoneIssueKind = z.infer<typeof phoneIssueKind>;

export const PHONE_ISSUE_LABEL: Record<PhoneIssueKind, string> = {
  JUNK: 'Số rác (0, 1 hoặc trống)',
  SHORT: 'Thiếu số',
  LONG: 'Dư số',
  OTHER: 'Khác',
};

/** Phân loại số gốc không đúng dạng 10 số để sửa theo nhóm. */
export function classifyPhoneRaw(raw: string): PhoneIssueKind {
  const digits = raw.replace(/\D/g, '');
  if (digits.length <= 1) return 'JUNK';
  if (digits.length <= 9) return 'SHORT';
  if (digits.length >= 11) return 'LONG';
  return 'OTHER';
}

export const badPhoneRow = z.object({
  id: z.uuid(),
  name: z.string(),
  code: z.string().nullable(),
  address: z.string(),
  phoneRaw: z.string(),
  kind: phoneIssueKind,
  orgUnitName: z.string().nullable(),
  assignedUserName: z.string().nullable(),
});
export type BadPhoneRow = z.infer<typeof badPhoneRow>;

export const badPhonesResult = pageResult(badPhoneRow).extend({
  counts: z.record(phoneIssueKind, z.number().int().nonnegative()),
});
export type BadPhonesResult = z.infer<typeof badPhonesResult>;

export const BAD_PHONE_PAGE_SIZE = 50;

export const badPhonesUrlParams = z
  .object({
    loai: phoneIssueKind.optional().catch(undefined),
    q: z.string().trim().max(100).optional().catch(undefined),
    trang: z.coerce.number().int().positive().max(1_000_000).catch(1),
  })
  .transform((url) => ({
    kind: url.loai,
    q: url.q || undefined,
    page: url.trang,
    pageSize: BAD_PHONE_PAGE_SIZE,
  }));
export type ListBadPhonesInput = z.infer<typeof badPhonesUrlParams>;

export const fixDealerPhoneInput = z.object({
  id: z.uuid(),
  phone: z
    .string()
    .trim()
    .transform((value, ctx) => {
      const normalized = normalizeVnPhone(value);
      if (!normalized) {
        ctx.addIssue({ code: 'custom', message: 'Số điện thoại gồm 10 số, bắt đầu bằng 0' });
        return z.NEVER;
      }
      return normalized;
    }),
});
export type FixDealerPhoneInput = z.infer<typeof fixDealerPhoneInput>;

/** Bỏ số sai (để trống điện thoại): theo danh sách chọn, hoặc toàn bộ số rác trong phạm vi. */
export const clearDealerPhonesInput = z.union([
  z.object({ ids: z.array(z.uuid()).min(1).max(5000) }),
  z.object({ kind: z.literal('JUNK') }),
]);
export type ClearDealerPhonesInput = z.infer<typeof clearDealerPhonesInput>;

// ---------- Đại lý trùng (A7b) ----------

export const duplicateKind = z.enum(['PHONE', 'TAX']);
export type DuplicateKind = z.infer<typeof duplicateKind>;

/** Từ 5 đại lý cùng một số trở lên thường là số giả hoặc số dùng chung, tách tab riêng. */
export const SHARED_PHONE_MIN = 5;

export const DUPLICATE_TABS = ['nghi-trung', 'so-dung-chung', 'ma-so-thue'] as const;
export type DuplicateTab = (typeof DUPLICATE_TABS)[number];

export const DUPLICATE_TAB_LABEL: Record<DuplicateTab, string> = {
  'nghi-trung': 'Nghi trùng số điện thoại',
  'so-dung-chung': 'Số dùng chung, số giả',
  'ma-so-thue': 'Trùng mã số thuế',
};

export const DUPLICATE_PAGE_SIZE = 20;

export const duplicatesUrlParams = z
  .object({
    tab: z.enum(DUPLICATE_TABS).catch('nghi-trung'),
    q: z.string().trim().max(100).optional().catch(undefined),
    trang: z.coerce.number().int().positive().max(1_000_000).catch(1),
  })
  .transform((url) => ({
    tab: url.tab,
    q: url.q || undefined,
    page: url.trang,
    pageSize: DUPLICATE_PAGE_SIZE,
  }));
export type ListDuplicatesInput = z.infer<typeof duplicatesUrlParams>;

export const duplicateMember = z.object({
  id: z.uuid(),
  code: z.string().nullable(),
  legacyCode: z.string().nullable(),
  name: z.string(),
  level: z.number().int(),
  address: z.string(),
  provinceName: z.string().nullable(),
  phone: z.string().nullable(),
  taxCode: z.string().nullable(),
  ownerName: z.string().nullable(),
  assignedUserName: z.string().nullable(),
  orgUnitName: z.string().nullable(),
  checkInCount: z.number().int().nonnegative(),
  hasLocation: z.boolean(),
});
export type DuplicateMember = z.infer<typeof duplicateMember>;

export const duplicateGroup = z.object({
  kind: duplicateKind,
  value: z.string(),
  sameName: z.boolean(),
  members: z.array(duplicateMember),
});
export type DuplicateGroup = z.infer<typeof duplicateGroup>;

export const listDuplicatesResult = pageResult(duplicateGroup).extend({
  counts: z.record(z.enum(DUPLICATE_TABS), z.number().int().nonnegative()),
});
export type ListDuplicatesResult = z.infer<typeof listDuplicatesResult>;

export const mergeDealersInput = z
  .object({
    keptId: z.uuid(),
    mergedIds: z.array(z.uuid()).min(1, 'Chọn ít nhất một đại lý để gộp').max(60),
  })
  .refine((input) => !input.mergedIds.includes(input.keptId), {
    path: ['mergedIds'],
    message: 'Đại lý giữ lại không gộp vào chính nó',
  });
export type MergeDealersInput = z.infer<typeof mergeDealersInput>;

export const dismissDuplicateInput = z.object({
  kind: duplicateKind,
  value: z.string().trim().min(1).max(50),
});
export type DismissDuplicateInput = z.infer<typeof dismissDuplicateInput>;

export const clearSharedPhoneInput = z.object({ phone: z.string().trim().min(1).max(20) });
export type ClearSharedPhoneInput = z.infer<typeof clearSharedPhoneInput>;

type MergeCandidate = { id: string; code: string | null };

/**
 * FAST là nguồn gốc danh mục (duyệt 18/11/2026): không gộp hai đại lý cùng có mã FAST, và có mã FAST thì
 * bản giữ lại phải là bản có mã. Trả câu báo lỗi hoặc null khi được gộp.
 */
export function mergeBlockReason(
  kept: MergeCandidate,
  merged: readonly MergeCandidate[],
): string | null {
  const withCode = [kept, ...merged].filter((dealer) => dealer.code);
  if (withCode.length > 1) {
    return 'Có từ hai đại lý cùng có mã FAST. Cần gộp trên FAST trước, rồi đồng bộ về DMS';
  }
  if (withCode.length === 1 && !kept.code) {
    return 'Chọn đại lý có mã FAST làm bản giữ lại';
  }
  return null;
}

export type FillableDealer = {
  phone: string | null;
  ownerName: string | null;
  ownerPhone: string | null;
  taxCode: string | null;
  provinceName: string | null;
  lat: number | null;
  lng: number | null;
};

export const FILL_FIELD_LABEL: Record<keyof FillableDealer, string> = {
  phone: 'Điện thoại',
  ownerName: 'Chủ đại lý',
  ownerPhone: 'Điện thoại chủ đại lý',
  taxCode: 'Mã số thuế',
  provinceName: 'Tỉnh, thành phố',
  lat: 'Toạ độ',
  lng: 'Toạ độ',
};

/** Ô bản giữ lại còn trống thì lấy từ bản gộp đầu tiên có giá trị; toạ độ lấy cả cặp. */
export function fillFromMerged(
  kept: FillableDealer,
  merged: readonly FillableDealer[],
): Partial<FillableDealer> {
  const fill: Partial<FillableDealer> = {};
  for (const key of ['phone', 'ownerName', 'ownerPhone', 'taxCode', 'provinceName'] as const) {
    if (kept[key]) continue;
    const source = merged.find((dealer) => dealer[key]);
    if (source?.[key]) fill[key] = source[key];
  }
  if (kept.lat === null || kept.lng === null) {
    const source = merged.find((dealer) => dealer.lat !== null && dealer.lng !== null);
    if (source) {
      fill.lat = source.lat;
      fill.lng = source.lng;
    }
  }
  return fill;
}
