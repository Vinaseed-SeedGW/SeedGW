import { z } from 'zod';
import { pageResult } from './common';
import { normalizeSearchText } from './text';

// Toạ độ đại lý từ check-in (M4): lần check-in đầu tại đại lý chưa có toạ độ thì đề xuất, Quản trị đơn vị duyệt.

// Chỉ đề xuất từ vị trí đủ tin cậy; vị trí kém thì chờ lần check-in sau.
export const PROPOSAL_MAX_ACCURACY_M = 50;

export const dealerLocationProposalStatus = z.enum(['PENDING', 'APPROVED', 'REJECTED']);
export type DealerLocationProposalStatus = z.infer<typeof dealerLocationProposalStatus>;

export const DEALER_LOCATION_STATUS_LABEL: Record<DealerLocationProposalStatus, string> = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
};

export const dealerLocationProposalRow = z.object({
  id: z.uuid(),
  dealerId: z.uuid(),
  dealerName: z.string(),
  dealerCode: z.string().nullable(),
  dealerAddress: z.string(),
  proposedByName: z.string(),
  proposedByCode: z.string(),
  capturedAt: z.iso.datetime(),
  checkInAddress: z.string().nullable(),
  lat: z.number(),
  lng: z.number(),
  accuracyM: z.number().nullable(),
  // null khi địa chỉ lúc chụp không đủ để so (không có số nhà, chưa lấy được địa chỉ).
  sameStreet: z.boolean().nullable(),
  photoUrl: z.string().nullable(),
  status: dealerLocationProposalStatus,
  reviewedByName: z.string().nullable(),
  reviewedAt: z.iso.datetime().nullable(),
  reviewNote: z.string(),
});
export type DealerLocationProposalRow = z.infer<typeof dealerLocationProposalRow>;

export const listDealerLocationProposalsResult = pageResult(dealerLocationProposalRow);
export type ListDealerLocationProposalsResult = z.infer<typeof listDealerLocationProposalsResult>;

export const DEALER_LOCATION_TABS = ['cho-duyet', 'da-xu-ly'] as const;
export type DealerLocationTab = (typeof DEALER_LOCATION_TABS)[number];

export type ListDealerLocationProposalsInput = {
  tab: DealerLocationTab;
  page: number;
  pageSize: number;
};

const PROPOSAL_PAGE_SIZE = 20;

export const dealerLocationUrlParams = z
  .object({
    tab: z.enum(DEALER_LOCATION_TABS).catch('cho-duyet'),
    trang: z.coerce.number().int().positive().max(1_000_000).catch(1),
  })
  .transform((url): ListDealerLocationProposalsInput => ({
    tab: url.tab,
    page: url.trang,
    pageSize: PROPOSAL_PAGE_SIZE,
  }));

export const reviewDealerLocationInput = z.object({
  id: z.uuid(),
  decision: z.enum(['APPROVE', 'REJECT']),
  note: z.string().trim().max(500).default(''),
});
export type ReviewDealerLocationInput = z.infer<typeof reviewDealerLocationInput>;

const HOUSE_NUMBER = /^(?:so\s+)?\d+[a-z]?(?:\/\d+[a-z]?)*\s+/;
const ALLEY = /^(?:ngo|ngach|hem|kiet)\s+\d+[a-z]?(?:\/\d+[a-z]?)*\s+/;
const STREET_WORD = /^(?:pho|duong)\s+/;

function plainWords(value: string): string {
  return normalizeSearchText(value)
    .replace(/[^a-z0-9/]+/g, ' ')
    .trim();
}

/**
 * Tên phố trong địa chỉ Vietmap lúc chụp, ví dụ "135 Phương Mai, Phường Kim Liên" ra "phuong mai".
 * Chỉ nhận khi phần đầu có số nhà hoặc ngõ, để địa chỉ thôn xóm không bị coi là tên phố.
 */
export function streetOf(address: string): string | null {
  let first = plainWords(address.split(',')[0] ?? '').replace(/^gan\s+/, '');
  let hasNumber = false;
  for (const pattern of [HOUSE_NUMBER, ALLEY, ALLEY]) {
    const match = pattern.exec(first);
    if (match) {
      hasNumber = true;
      first = first.slice(match[0].length);
    }
  }
  first = first.replace(STREET_WORD, '');
  const street = first.replace(/\//g, ' ').trim();
  return hasNumber && /[a-z]{2}/.test(street) ? street : null;
}

/**
 * Địa chỉ lúc chụp có cùng phố với địa chỉ đại lý trong danh mục không. null là không đủ thông tin để so,
 * khi đó không gắn cờ. Chỉ là gợi ý cho quản lý, không chặn check-in.
 */
export function isSameStreet(checkInAddress: string | null, dealerAddress: string): boolean | null {
  if (!checkInAddress) return null;
  const street = streetOf(checkInAddress);
  // Địa chỉ cũ hay viết dính số nhà vào chữ, ví dụ "34Ngõ 34 Phố Hoàng Cầu".
  const dealer = plainWords(dealerAddress)
    .replace(/\//g, ' ')
    .replace(/(\d)([a-z])/g, '$1 $2');
  if (!street || !dealer) return null;
  return ` ${dealer} `.includes(` ${street} `);
}
