import { z } from 'zod';
import { MAX_PAGE_SIZE, pageResult } from './common';
import { normalizeVnPhone } from './dealers';
import { PROVINCES } from './provinces';
import { provinceFromSlug } from './regions';

// S1: khách hàng nông dân, hợp tác xã. Mã KH00001 do SeedGW cấp, diện tích lưu theo ha (chốt 25/11/2026).

export const customerKind = z.enum(['FARMER', 'COOPERATIVE']);
export type CustomerKind = z.infer<typeof customerKind>;

export const CUSTOMER_KIND_LABEL: Record<CustomerKind, string> = {
  FARMER: 'Nông dân',
  COOPERATIVE: 'Hợp tác xã',
};

const CUSTOMER_KIND_SLUG: Record<CustomerKind, string> = {
  FARMER: 'nong-dan',
  COOPERATIVE: 'hop-tac-xa',
};

export function customerKindSlug(kind: CustomerKind): string {
  return CUSTOMER_KIND_SLUG[kind];
}

/** Gợi ý khi nhập cây trồng; vẫn gõ được cây khác. */
export const CROP_SUGGESTIONS = [
  'Lúa',
  'Ngô',
  'Đậu, lạc',
  'Rau màu',
  'Cây ăn quả',
  'Cà phê',
  'Hồ tiêu',
] as const;

export const MAX_CUSTOMER_CROPS = 10;
export const MAX_CUSTOMER_DEALERS = 10;
export const MAX_AREA_HA = 100_000;

/** Làm tròn diện tích 2 chữ số sau dấu phẩy, hiện dạng 1,25 ha. */
export function formatAreaHa(value: number | null): string {
  if (value === null) return '';
  return `${value.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} ha`;
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

const AREA_MESSAGE = `Diện tích từ 0 đến ${MAX_AREA_HA.toLocaleString('vi-VN')} ha, ví dụ 1,5`;

/** Diện tích gõ tay, nhận cả dấu phẩy thập phân. Ô trống là chưa biết. */
const areaField = z
  .union([z.number(), z.string(), z.null()])
  .transform((value) =>
    value === null || value === '' ? null : Number(String(value).trim().replace(',', '.')),
  )
  .pipe(z.number(AREA_MESSAGE).min(0, AREA_MESSAGE).max(MAX_AREA_HA, AREA_MESSAGE).nullable())
  .transform((value) => (value === null ? null : Math.round(value * 100) / 100));

const cropsField = z
  .array(z.string().trim().max(50, 'Tên cây trồng tối đa 50 ký tự'))
  .max(MAX_CUSTOMER_CROPS, `Tối đa ${MAX_CUSTOMER_CROPS} loại cây trồng`)
  .transform((items) => [...new Set(items.filter(Boolean))]);

// ---------- Danh sách ----------

export const customerSummary = z.object({
  id: z.uuid(),
  code: z.string(),
  kind: customerKind,
  name: z.string(),
  phone: z.string().nullable(),
  provinceName: z.string().nullable(),
  crops: z.array(z.string()),
  areaHa: z.number().nullable(),
  assignedUserName: z.string().nullable(),
  dealerNames: z.array(z.string()),
  lastVisitedAt: z.iso.datetime().nullable(),
});
export type CustomerSummary = z.infer<typeof customerSummary>;

export const customerSort = z.enum(['name', '-name', 'code', '-code', '-lastVisitedAt']);
const DEFAULT_CUSTOMER_SORT = 'name';

export const listCustomersInput = z.object({
  q: z.string().trim().max(100).optional(),
  kind: customerKind.optional(),
  province: z.enum(PROVINCES).optional(),
  crop: z.string().trim().max(50).optional(),
  dealerId: z.uuid().optional(),
  sort: customerSort.default(DEFAULT_CUSTOMER_SORT),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(MAX_PAGE_SIZE).default(20),
});
export type ListCustomersInput = z.infer<typeof listCustomersInput>;

export const listCustomersResult = pageResult(customerSummary);
export type ListCustomersResult = z.infer<typeof listCustomersResult>;

const CUSTOMER_PAGE_SIZE = 20;

export const customersUrlParams = z
  .object({
    q: z.string().trim().max(100).optional().catch(undefined),
    loai: z.enum(['nong-dan', 'hop-tac-xa']).optional().catch(undefined),
    tinh: z
      .string()
      .transform((value) => provinceFromSlug(value) ?? undefined)
      .optional()
      .catch(undefined),
    cay: z.string().trim().max(50).optional().catch(undefined),
    'dai-ly': z.uuid().optional().catch(undefined),
    'sap-xep': customerSort.catch(DEFAULT_CUSTOMER_SORT),
    trang: z.coerce.number().int().positive().max(1_000_000).catch(1),
  })
  .transform((url): ListCustomersInput => ({
    q: url.q || undefined,
    kind:
      url.loai === 'nong-dan' ? 'FARMER' : url.loai === 'hop-tac-xa' ? 'COOPERATIVE' : undefined,
    province: url.tinh,
    crop: url.cay || undefined,
    dealerId: url['dai-ly'],
    sort: url['sap-xep'],
    page: url.trang,
    pageSize: CUSTOMER_PAGE_SIZE,
  }));

// ---------- Hồ sơ ----------

export const customerDealer = z.object({
  id: z.uuid(),
  name: z.string(),
  code: z.string().nullable(),
});
export type CustomerDealer = z.infer<typeof customerDealer>;

export const customerDetail = customerSummary.extend({
  address: z.string(),
  note: z.string().nullable(),
  dealers: z.array(customerDealer),
  orgUnitName: z.string().nullable(),
  assignedUserId: z.uuid().nullable(),
  createdByName: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type CustomerDetail = z.infer<typeof customerDetail>;

export const customerVisit = z.object({
  id: z.uuid(),
  capturedAt: z.iso.datetime(),
  userName: z.string(),
  note: z.string(),
  address: z.string().nullable(),
  flagged: z.boolean(),
});
export type CustomerVisit = z.infer<typeof customerVisit>;

// ---------- Tạo, sửa ----------

const customerFields = z.object({
  kind: customerKind,
  name: z.string().trim().min(2, 'Nhập tên khách hàng, ít nhất 2 ký tự').max(200),
  phone: phoneField,
  provinceName: z.enum(PROVINCES).nullable(),
  address: z.string().trim().max(500).default(''),
  crops: cropsField,
  areaHa: areaField,
  dealerIds: z.array(z.uuid()).max(MAX_CUSTOMER_DEALERS, `Tối đa ${MAX_CUSTOMER_DEALERS} đại lý`),
  // Để trống thì người tạo là người phụ trách. Đơn vị của khách hàng theo đơn vị người phụ trách.
  assignedUserId: z.uuid().nullable(),
  note: optionalText(1000),
});

export const createCustomerInput = customerFields;
export type CreateCustomerInput = z.infer<typeof createCustomerInput>;

export const updateCustomerInput = customerFields.extend({ id: z.uuid() });
export type UpdateCustomerInput = z.infer<typeof updateCustomerInput>;

/** Giá trị form trước khi validate, để form client dùng đúng kiểu. */
export type CustomerFormValues = z.input<typeof customerFields>;

export type CustomerOption = { value: string; label: string };

// ---------- App điện thoại ----------

export const mobileCustomersQuery = z.object({
  q: z.string().trim().max(100).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});
export type MobileCustomersQuery = z.infer<typeof mobileCustomersQuery>;

export const mobileCustomerOption = z.object({
  id: z.uuid(),
  code: z.string(),
  kind: customerKind,
  name: z.string(),
  phone: z.string().nullable(),
  address: z.string(),
  distanceM: z.number().nullable(),
});
export type MobileCustomerOption = z.infer<typeof mobileCustomerOption>;

export const mobileCustomersResult = z.object({ items: z.array(mobileCustomerOption) });
export type MobileCustomersResult = z.infer<typeof mobileCustomersResult>;
