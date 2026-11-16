import { z } from 'zod';
import { MAX_PAGE_SIZE, pageResult } from './common';
import { PROVINCES } from './provinces';

// Danh mục đại lý (A7). Mã đại lý là mã khách hàng trên FAST, mã DMS cũ giữ để tìm và nhập lại.

export const dealerLevel = z.union([z.literal(1), z.literal(2), z.literal(3)]);
export type DealerLevel = z.infer<typeof dealerLevel>;
export const DEALER_LEVELS = [1, 2, 3] as const satisfies readonly DealerLevel[];

export const DEALER_LEVEL_LABEL: Record<DealerLevel, string> = {
  1: 'Cấp 1',
  2: 'Cấp 2',
  3: 'Cấp 3',
};

export const dealerStatus = z.enum(['ACTIVE', 'INACTIVE']);
export type DealerStatus = z.infer<typeof dealerStatus>;

export const DEALER_STATUS_LABEL: Record<DealerStatus, string> = {
  ACTIVE: 'Đang hoạt động',
  INACTIVE: 'Ngừng hoạt động',
};

/** Mã DMS cũ dạng VR02.C2.0083418: tiền tố đơn vị, cấp đại lý, số thứ tự. */
export function parseLegacyDealerCode(
  code: string,
): { unitPrefix: string; level: DealerLevel } | null {
  const match = /^([^.\s]+)\.C([123])\.\d+$/i.exec(code.trim());
  if (!match?.[1] || !match[2]) return null;
  return { unitPrefix: match[1].toUpperCase(), level: Number(match[2]) as DealerLevel };
}

/** Đưa số điện thoại Việt Nam về dạng 0xxxxxxxxx. Số sai trả null để giữ bản gốc và gắn cờ cần sửa. */
export function normalizeVnPhone(raw: string): string | null {
  let digits = raw.replace(/[\s.\-()]/g, '');
  if (digits.startsWith('+84')) digits = `0${digits.slice(3)}`;
  else if (/^84\d{9}$/.test(digits)) digits = `0${digits.slice(2)}`;
  return /^0\d{9}$/.test(digits) ? digits : null;
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)
    .nullable();

const phoneField = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (!value) return null;
    const normalized = normalizeVnPhone(value);
    if (!normalized) {
      ctx.addIssue({ code: 'custom', message: 'Số điện thoại gồm 10 số, bắt đầu bằng 0' });
      return z.NEVER;
    }
    return normalized;
  })
  .nullable();

/** Toạ độ gõ tay trên form, nhận cả dấu phẩy thập phân. Ô trống là chưa có toạ độ. */
const coordinate = (limit: number, message: string) =>
  z
    .union([z.number(), z.string(), z.null()])
    .transform((value) =>
      value === null || value === '' ? null : Number(String(value).trim().replace(',', '.')),
    )
    .pipe(z.number(message).min(-limit, message).max(limit, message).nullable());

// ---------- Danh sách ----------

export const dealerSummary = z.object({
  id: z.uuid(),
  code: z.string().nullable(),
  legacyCode: z.string().nullable(),
  name: z.string(),
  level: dealerLevel,
  status: dealerStatus,
  phone: z.string().nullable(),
  provinceName: z.string().nullable(),
  orgUnitName: z.string().nullable(),
  assignedUserName: z.string().nullable(),
  legacyAssigneeName: z.string().nullable(),
  hasLocation: z.boolean(),
});
export type DealerSummary = z.infer<typeof dealerSummary>;

export const DEALER_ASSIGNEE_UNASSIGNED = 'chua-gan';

export const dealerSort = z.enum(['name', '-name', 'code', '-code', '-updatedAt']);
const DEFAULT_DEALER_SORT = 'name';

export const listDealersInput = z.object({
  q: z.string().trim().max(100).optional(),
  level: dealerLevel.optional(),
  status: dealerStatus.optional(),
  orgUnitId: z.uuid().optional(),
  unassignedOnly: z.boolean().default(false),
  missingLocationOnly: z.boolean().default(false),
  sort: dealerSort.default(DEFAULT_DEALER_SORT),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(MAX_PAGE_SIZE).default(20),
});
export type ListDealersInput = z.infer<typeof listDealersInput>;

export const dealerFilter = listDealersInput.omit({ sort: true, page: true, pageSize: true });
export type DealerFilter = z.infer<typeof dealerFilter>;

export const listDealersResult = pageResult(dealerSummary);
export type ListDealersResult = z.infer<typeof listDealersResult>;

const DEALER_PAGE_SIZE = 20;

export const dealersUrlParams = z
  .object({
    q: z.string().trim().max(100).optional().catch(undefined),
    cap: z.coerce.number().pipe(dealerLevel).optional().catch(undefined),
    'trang-thai': z.enum(['dang-hoat-dong', 'ngung-hoat-dong']).optional().catch(undefined),
    'don-vi': z.uuid().optional().catch(undefined),
    'nhan-vien': z.enum([DEALER_ASSIGNEE_UNASSIGNED]).optional().catch(undefined),
    'toa-do': z.enum(['chua-co']).optional().catch(undefined),
    'sap-xep': dealerSort.catch(DEFAULT_DEALER_SORT),
    trang: z.coerce.number().int().positive().max(1_000_000).catch(1),
  })
  .transform((url): ListDealersInput => ({
    q: url.q || undefined,
    level: url.cap,
    status:
      url['trang-thai'] === 'dang-hoat-dong'
        ? 'ACTIVE'
        : url['trang-thai'] === 'ngung-hoat-dong'
          ? 'INACTIVE'
          : undefined,
    orgUnitId: url['don-vi'],
    unassignedOnly: url['nhan-vien'] === DEALER_ASSIGNEE_UNASSIGNED,
    missingLocationOnly: url['toa-do'] === 'chua-co',
    sort: url['sap-xep'],
    page: url.trang,
    pageSize: DEALER_PAGE_SIZE,
  }));

// ---------- Hồ sơ ----------

export const dealerDetail = dealerSummary.extend({
  taxCode: z.string().nullable(),
  phoneRaw: z.string().nullable(),
  ownerName: z.string().nullable(),
  ownerPhone: z.string().nullable(),
  address: z.string(),
  legacyAdminArea: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  locatedAt: z.iso.datetime().nullable(),
  parent: z
    .object({
      id: z.uuid(),
      name: z.string(),
      code: z.string().nullable(),
      legacyCode: z.string().nullable(),
    })
    .nullable(),
  orgUnitId: z.uuid().nullable(),
  assignedUserId: z.uuid().nullable(),
  legacyOrgUnitName: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type DealerDetail = z.infer<typeof dealerDetail>;

// Tên, mã FAST, mã số thuế thuộc FAST nên không sửa trên DMS (DESIGN_BRIEF §10, cách C).
export const updateDealerInput = z
  .object({
    id: z.uuid(),
    level: z.coerce.number().pipe(dealerLevel),
    status: dealerStatus,
    // Nhập mã FAST hoặc mã DMS cũ của đại lý cấp trên, để trống nếu không có.
    parentCode: optionalText(50),
    phone: phoneField,
    ownerName: optionalText(120),
    ownerPhone: phoneField,
    address: z.string().trim().min(1, 'Nhập địa chỉ').max(300),
    provinceName: z.enum(PROVINCES).nullable(),
    lat: coordinate(90, 'Vĩ độ từ -90 đến 90, ví dụ 21.0285'),
    lng: coordinate(180, 'Kinh độ từ -180 đến 180, ví dụ 105.8542'),
    orgUnitId: z.uuid('Chọn đơn vị phụ trách'),
    assignedUserId: z.uuid().nullable(),
  })
  .refine((value) => (value.lat === null) === (value.lng === null), {
    path: ['lat'],
    message: 'Nhập đủ cả vĩ độ và kinh độ',
  });
export type UpdateDealerInput = z.infer<typeof updateDealerInput>;

// ---------- Thao tác hàng loạt ----------

export const MAX_BULK_DEALERS = 20_000;

/** Áp cho các dòng đã chọn, hoặc cho mọi đại lý khớp bộ lọc khi không chọn dòng nào. */
const bulkTarget = z.object({
  filter: dealerFilter,
  ids: z.array(z.uuid()).max(MAX_BULK_DEALERS),
});

export const bulkAssignDealersInput = bulkTarget.extend({
  assignedUserId: z.uuid().nullable(),
});
export type BulkAssignDealersInput = z.infer<typeof bulkAssignDealersInput>;

export const bulkMoveDealersInput = bulkTarget.extend({
  orgUnitId: z.uuid('Chọn đơn vị phụ trách'),
});
export type BulkMoveDealersInput = z.infer<typeof bulkMoveDealersInput>;

// ---------- Nhập Excel từ DMS cũ ----------

export const MAX_DEALER_IMPORT_BYTES = 12 * 1024 * 1024;
export const MAX_DEALER_IMPORT_ROWS = 50_000;

export const dealerImportUnitAction = z.enum(['CREATE', 'EXISTING', 'SKIP']);
export type DealerImportUnitAction = z.infer<typeof dealerImportUnitAction>;

export const dealerImportUnit = z.object({
  legacyName: z.string(),
  rowCount: z.number().int(),
  suggestedCode: z.string(),
  suggestedAction: dealerImportUnitAction,
  matchedOrgUnitId: z.uuid().nullable(),
});
export type DealerImportUnit = z.infer<typeof dealerImportUnit>;

export const dealerImportIssue = z.object({
  rowNumber: z.number().int(),
  legacyCode: z.string(),
  message: z.string(),
});
export type DealerImportIssue = z.infer<typeof dealerImportIssue>;

export type DealerImportPreview = {
  totalRows: number;
  validRows: number;
  newCount: number;
  existingCount: number;
  levelCounts: Record<DealerLevel, number>;
  withFastCode: number;
  invalidPhoneCount: number;
  unknownProvinceCount: number;
  assigneeMatched: number;
  assigneeUnmatched: number;
  errors: DealerImportIssue[];
  errorCount: number;
  warnings: DealerImportIssue[];
  warningCount: number;
  units: DealerImportUnit[];
};

export const dealerImportUnitChoice = z
  .object({
    legacyName: z.string(),
    action: dealerImportUnitAction,
    orgUnitId: z.uuid().nullable(),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{2,30}$/, 'Mã đơn vị gồm 2-30 ký tự: chữ không dấu, số, gạch ngang')
      .nullable(),
  })
  .refine((value) => value.action !== 'EXISTING' || value.orgUnitId !== null, {
    path: ['orgUnitId'],
    message: 'Chọn đơn vị có sẵn',
  })
  .refine((value) => value.action !== 'CREATE' || value.code !== null, {
    path: ['code'],
    message: 'Nhập mã cho đơn vị mới',
  });
export type DealerImportUnitChoice = z.infer<typeof dealerImportUnitChoice>;

export const commitDealerImportInput = z.object({
  units: z.array(dealerImportUnitChoice).max(500),
});

export type DealerImportResult = {
  created: number;
  updated: number;
  skipped: number;
  errorCount: number;
  createdUnits: number;
};

// ---------- App: chọn đại lý khi check-in ----------

export const mobileDealersQuery = z.object({
  q: z.string().trim().max(100).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

export const mobileDealerOption = z.object({
  id: z.uuid(),
  code: z.string().nullable(),
  legacyCode: z.string().nullable(),
  name: z.string(),
  address: z.string(),
  level: dealerLevel,
  // Toa do da duyet (M4), app dung de tinh khoang cach luc check-in va hoi ly do khi xa.
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  distanceM: z.number().nullable(),
});
export type MobileDealerOption = z.infer<typeof mobileDealerOption>;

export const mobileDealersResult = z.object({
  items: z.array(mobileDealerOption),
  // Bán kính check-in hợp lệ trong Tham số, app hỏi lý do khi chụp xa đại lý hơn mức này.
  radiusM: z.number().int().positive(),
});
export type MobileDealersResult = z.infer<typeof mobileDealersResult>;

export type DealerOption = { value: string; label: string };

/** Lựa chọn cho form sửa và thao tác hàng loạt, đã lọc theo phạm vi của người đang dùng. */
export type DealerFormOptions = {
  orgUnits: DealerOption[];
  users: DealerOption[];
  canEdit: boolean;
  canMoveOrgUnit: boolean;
};
