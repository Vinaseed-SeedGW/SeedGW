import { z } from 'zod';
import { pageResult } from './common';
import { parseDisplayDate } from './format';
import { dealerLevel, normalizeVnPhone, type DealerLevel, type DealerUserOption } from './dealers';
import { PROVINCES, type ProvinceName } from './provinces';

// Đề xuất đại lý mới trên app (M10, 20/11/2026). Đề xuất đi kèm một lượt check-in tại cửa hàng nên có sẵn
// ảnh, toạ độ, giờ máy chủ và địa chỉ lúc chụp. Duyệt thì tạo đại lý, chưa có mã FAST (S10).
// 25/11/2026: Quản lý trực tiếp hoặc Lãnh đạo đơn vị duyệt một bước; người có quyền duyệt tự đề xuất thì
// tạo luôn; Quản trị đơn vị chỉ xem, Quản trị hệ thống duyệt thay.

/** Mặc định khi nhân viên không chọn cấp, người duyệt chốt lại. */
export const DEFAULT_PROPOSED_LEVEL: DealerLevel = 3;
/** Đại lý có sẵn trong bán kính này quanh điểm chụp thì cảnh báo có thể trùng. */
export const DUPLICATE_RADIUS_M = 100;

export const dealerProposalStatus = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'DUPLICATE']);
export type DealerProposalStatus = z.infer<typeof dealerProposalStatus>;

export const DEALER_PROPOSAL_STATUS_LABEL: Record<DealerProposalStatus, string> = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
  DUPLICATE: 'Trùng đại lý có sẵn',
};

/** Mã số thuế Việt Nam: 10 số, hoặc 10 số kèm 3 số chi nhánh. */
export function normalizeTaxCode(raw: string): string | null {
  const compact = raw.replace(/[\s.]/g, '');
  const match = /^(\d{10})(?:-?(\d{3}))?$/.exec(compact);
  if (!match?.[1]) return null;
  return match[2] ? `${match[1]}-${match[2]}` : match[1];
}

const requiredPhone = z
  .string()
  .trim()
  .min(1, 'Nhập số điện thoại')
  .transform((value, ctx) => {
    const normalized = normalizeVnPhone(value);
    if (!normalized) {
      ctx.addIssue({ code: 'custom', message: 'Số điện thoại gồm 10 số, bắt đầu bằng 0' });
      return z.NEVER;
    }
    return normalized;
  });

const optionalTaxCode = z
  .string()
  .trim()
  .max(20)
  .nullable()
  .default(null)
  .transform((value, ctx) => {
    if (!value) return null;
    const normalized = normalizeTaxCode(value);
    if (!normalized) {
      ctx.addIssue({ code: 'custom', message: 'Mã số thuế gồm 10 số, chi nhánh thêm 3 số' });
      return z.NEVER;
    }
    return normalized;
  });

const optionalName = z
  .string()
  .trim()
  .max(120)
  .nullable()
  .default(null)
  .transform((value) => value || null);

/** Phần đề xuất gửi kèm check-in từ app. */
export const newDealerInput = z.object({
  name: z.string().trim().min(1, 'Nhập tên đại lý').max(200),
  phone: requiredPhone,
  address: z.string().trim().min(1, 'Nhập địa chỉ').max(300),
  ownerName: optionalName,
  taxCode: optionalTaxCode,
  level: dealerLevel.default(DEFAULT_PROPOSED_LEVEL),
});
export type NewDealerInput = z.infer<typeof newDealerInput>;

// ---------- Trang duyệt trên web ----------

export const duplicateReason = z.enum(['PHONE', 'TAX_CODE', 'NEARBY']);
export type DuplicateReason = z.infer<typeof duplicateReason>;

export const DUPLICATE_REASON_LABEL: Record<DuplicateReason, string> = {
  PHONE: 'Cùng số điện thoại',
  TAX_CODE: 'Cùng mã số thuế',
  NEARBY: 'Ở gần',
};

export const duplicateCandidate = z.object({
  id: z.uuid(),
  name: z.string(),
  code: z.string().nullable(),
  address: z.string(),
  reasons: z.array(duplicateReason),
  distanceM: z.number().nullable(),
});
export type DuplicateCandidate = z.infer<typeof duplicateCandidate>;

export const dealerProposalRow = z.object({
  id: z.uuid(),
  name: z.string(),
  phone: z.string(),
  address: z.string(),
  ownerName: z.string().nullable(),
  taxCode: z.string().nullable(),
  level: dealerLevel,
  orgUnitId: z.uuid().nullable(),
  orgUnitName: z.string().nullable(),
  proposedById: z.uuid(),
  proposedByName: z.string(),
  proposedByCode: z.string(),
  capturedAt: z.iso.datetime(),
  checkInAddress: z.string().nullable(),
  lat: z.number(),
  lng: z.number(),
  accuracyM: z.number().nullable(),
  photoUrl: z.string().nullable(),
  status: dealerProposalStatus,
  reviewedByName: z.string().nullable(),
  reviewedAt: z.iso.datetime().nullable(),
  reviewNote: z.string(),
  currentApproverName: z.string().nullable(),
  // Đại lý đã tạo khi duyệt, hoặc đại lý có sẵn khi đánh dấu trùng.
  dealer: z.object({ id: z.uuid(), name: z.string() }).nullable(),
  duplicates: z.array(duplicateCandidate),
});
export type DealerProposalRow = z.infer<typeof dealerProposalRow>;

export const listDealerProposalsResult = pageResult(dealerProposalRow);
export type ListDealerProposalsResult = z.infer<typeof listDealerProposalsResult>;

export const DEALER_PROPOSAL_TABS = ['cho-duyet', 'da-xu-ly'] as const;
export type DealerProposalTab = (typeof DEALER_PROPOSAL_TABS)[number];

export type ListDealerProposalsInput = {
  tab: DealerProposalTab;
  page: number;
  pageSize: number;
};

const PROPOSAL_PAGE_SIZE = 20;

export const dealerProposalUrlParams = z
  .object({
    tab: z.enum(DEALER_PROPOSAL_TABS).catch('cho-duyet'),
    trang: z.coerce.number().int().positive().max(1_000_000).catch(1),
  })
  .transform((url): ListDealerProposalsInput => ({
    tab: url.tab,
    page: url.trang,
    pageSize: PROPOSAL_PAGE_SIZE,
  }));

/** Người duyệt chỉnh lại thông tin trước khi tạo đại lý. */
export const approveDealerProposalInput = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1, 'Nhập tên đại lý').max(200),
  phone: requiredPhone,
  address: z.string().trim().min(1, 'Nhập địa chỉ').max(300),
  ownerName: optionalName,
  taxCode: optionalTaxCode,
  level: z.coerce.number().pipe(dealerLevel),
  // K7b: tỉnh của đại lý mới, gợi ý từ địa chỉ lúc chụp.
  provinceName: z.enum(PROVINCES).nullable(),
  orgUnitId: z.uuid('Chọn đơn vị phụ trách'),
  assignedUserId: z.uuid().nullable(),
});
export type ApproveDealerProposalInput = z.infer<typeof approveDealerProposalInput>;

export const rejectDealerProposalInput = z.object({
  id: z.uuid(),
  note: z.string().trim().min(5, 'Lý do từ 5 ký tự').max(500, 'Lý do tối đa 500 ký tự'),
});
export type RejectDealerProposalInput = z.infer<typeof rejectDealerProposalInput>;

/** Đề xuất trùng một đại lý có sẵn: lượt check-in được gắn vào đại lý đó. */
export const markDuplicateDealerProposalInput = z.object({
  id: z.uuid(),
  dealerId: z.uuid('Chọn đại lý có sẵn'),
  note: z.string().trim().max(500).default(''),
});
export type MarkDuplicateDealerProposalInput = z.infer<typeof markDuplicateDealerProposalInput>;

export type DealerProposalOptions = {
  orgUnits: { value: string; label: string }[];
  users: DealerUserOption[];
  // K7b: đơn vị phụ trách từng tỉnh, để gợi ý đơn vị cho đại lý mới.
  provinceUnits: Partial<Record<ProvinceName, string[]>>;
};

// ---------- App: đề xuất của tôi ----------

export const myDealerProposal = z.object({
  id: z.uuid(),
  name: z.string(),
  address: z.string(),
  capturedAt: z.iso.datetime(),
  status: dealerProposalStatus,
  reviewNote: z.string(),
  dealerName: z.string().nullable(),
});
export type MyDealerProposal = z.infer<typeof myDealerProposal>;

export const myDealerProposalsResult = z.object({ items: z.array(myDealerProposal) });
export type MyDealerProposalsResult = z.infer<typeof myDealerProposalsResult>;

/** App hiện các đề xuất trong khoảng này. */
export const MY_PROPOSALS_DAYS = 90;

// ---------- Web: Đại lý đề xuất (theo phạm vi) ----------

export const PROPOSAL_STATUS_PARAM = {
  'cho-duyet': 'PENDING',
  'da-duyet': 'APPROVED',
  trung: 'DUPLICATE',
  'tu-choi': 'REJECTED',
} as const satisfies Record<string, DealerProposalStatus>;

export type ScopedProposalsInput = {
  q?: string;
  status?: DealerProposalStatus;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
};

const dateParam = z
  .string()
  .transform((value) => parseDisplayDate(value) ?? undefined)
  .optional()
  .catch(undefined);

export const scopedProposalsUrlParams = z
  .object({
    q: z.string().trim().max(100).optional().catch(undefined),
    'trang-thai': z.enum(['cho-duyet', 'da-duyet', 'trung', 'tu-choi']).optional().catch(undefined),
    'tu-ngay': dateParam,
    'den-ngay': dateParam,
    trang: z.coerce.number().int().positive().max(1_000_000).catch(1),
  })
  .transform((url): ScopedProposalsInput => ({
    q: url.q || undefined,
    status: url['trang-thai'] ? PROPOSAL_STATUS_PARAM[url['trang-thai']] : undefined,
    from: url['tu-ngay'],
    to: url['den-ngay'],
    page: url.trang,
    pageSize: PROPOSAL_PAGE_SIZE,
  }));

// ---------- App: duyệt nhanh ở tab Tôi ----------

/** Duyệt trên app giữ nguyên thông tin như đề xuất; muốn sửa hoặc chọn Trùng thì làm trên web. */
export const mobileProposalDecision = z.discriminatedUnion('decision', [
  z.object({ decision: z.literal('APPROVE') }),
  z.object({
    decision: z.literal('REJECT'),
    note: z.string().trim().min(5, 'Lý do từ 5 ký tự').max(500, 'Lý do tối đa 500 ký tự'),
  }),
]);
export type MobileProposalDecision = z.infer<typeof mobileProposalDecision>;

export type MobileProposalReviewItem = {
  id: string;
  name: string;
  phone: string;
  address: string;
  ownerName: string | null;
  taxCode: string | null;
  levelLabel: string;
  proposedByName: string;
  capturedAt: string;
  checkInAddress: string | null;
  duplicates: { name: string; reasons: string }[];
};

export type MobileProposalReviewList = { items: MobileProposalReviewItem[] };
