import { z } from 'zod';

type SettingDefinition = {
  key: string;
  label: string;
  min: number;
  max: number;
  defaultValue: number;
  hint?: string;
};

const SALES_SETTINGS = [
  {
    key: 'checkInRadiusM',
    label: 'Bán kính check-in hợp lệ (m)',
    min: 10,
    max: 5000,
    defaultValue: 200,
    hint: 'Ngoài bán kính này check-in vẫn được ghi nhận và gắn cờ.',
  },
  {
    key: 'debtWarningPercent',
    label: 'Ngưỡng cảnh báo công nợ (%)',
    min: 1,
    max: 200,
    defaultValue: 100,
    hint: 'Tính trên hạn mức của đại lý. Chỉ cảnh báo, không chặn tạo đơn.',
  },
  {
    key: 'dealerInactiveDays',
    label: 'Số ngày coi là đại lý không đặt hàng',
    min: 1,
    max: 365,
    defaultValue: 30,
    hint: 'Tính từ đơn đã duyệt gần nhất.',
  },
] as const satisfies readonly SettingDefinition[];

const TICKET_SLA_SETTINGS = [
  {
    key: 'slaHighFirstResponseMinutes',
    label: 'Mức Cao: phản hồi đầu (phút)',
    min: 1,
    max: 10080,
    defaultValue: 30,
  },
  {
    key: 'slaHighResolveHours',
    label: 'Mức Cao: giải quyết (giờ)',
    min: 1,
    max: 720,
    defaultValue: 8,
  },
  {
    key: 'slaMediumFirstResponseMinutes',
    label: 'Mức Trung bình: phản hồi đầu (phút)',
    min: 1,
    max: 10080,
    defaultValue: 120,
  },
  {
    key: 'slaMediumResolveHours',
    label: 'Mức Trung bình: giải quyết (giờ)',
    min: 1,
    max: 720,
    defaultValue: 24,
  },
  {
    key: 'slaLowFirstResponseMinutes',
    label: 'Mức Thấp: phản hồi đầu (phút)',
    min: 1,
    max: 10080,
    defaultValue: 480,
  },
  {
    key: 'slaLowResolveHours',
    label: 'Mức Thấp: giải quyết (giờ)',
    min: 1,
    max: 720,
    defaultValue: 72,
  },
] as const satisfies readonly SettingDefinition[];

const FAST_SYNC_SETTINGS = [
  {
    key: 'fastCatalogSyncMinutes',
    label: 'Danh mục sản phẩm, kho, đại lý (phút)',
    min: 15,
    max: 1440,
    defaultValue: 60,
  },
  {
    key: 'fastStockDebtSyncMinutes',
    label: 'Tồn kho và công nợ (phút)',
    min: 5,
    max: 1440,
    defaultValue: 15,
  },
  {
    key: 'fastInvoiceSyncMinutes',
    label: 'Hoá đơn bán và hàng trả lại (phút)',
    min: 15,
    max: 1440,
    defaultValue: 60,
  },
] as const satisfies readonly SettingDefinition[];

export const SETTING_GROUPS = [
  { title: 'Kinh doanh', settings: SALES_SETTINGS },
  { title: 'SLA CSKH theo mức ưu tiên', settings: TICKET_SLA_SETTINGS },
  { title: 'Chu kỳ đồng bộ FAST', settings: FAST_SYNC_SETTINGS },
] as const;

const ALL_SETTINGS = [...SALES_SETTINGS, ...TICKET_SLA_SETTINGS, ...FAST_SYNC_SETTINGS];

export type SettingKey = (typeof ALL_SETTINGS)[number]['key'];
export type SystemSettings = Record<SettingKey, number>;

export const SETTING_LABEL = Object.fromEntries(
  ALL_SETTINGS.map(({ key, label }) => [key, label]),
) as Record<SettingKey, string>;

// Form gui chuoi nen ep kieu ve so, o trong thanh 0 va bi chan boi gia tri nho nhat.
function integerInRange(min: number, max: number) {
  const message = `Nhập số nguyên từ ${min} đến ${max}`;
  return z.coerce
    .number<number>({ error: message })
    .int(message)
    .min(min, message)
    .max(max, message);
}

const SETTING_FIELDS = Object.fromEntries(
  ALL_SETTINGS.map(({ key, min, max }) => [key, integerInRange(min, max)]),
) as Record<SettingKey, ReturnType<typeof integerInRange>>;

const SLA_PAIRS = [
  ['slaHighFirstResponseMinutes', 'slaHighResolveHours'],
  ['slaMediumFirstResponseMinutes', 'slaMediumResolveHours'],
  ['slaLowFirstResponseMinutes', 'slaLowResolveHours'],
] as const satisfies ReadonlyArray<readonly [SettingKey, SettingKey]>;

export const saveSystemSettingsInput = z
  .object({ expectedUpdatedAt: z.iso.datetime(), ...SETTING_FIELDS })
  .superRefine((values, context) => {
    for (const [firstResponse, resolve] of SLA_PAIRS) {
      if (values[firstResponse] > values[resolve] * 60) {
        context.addIssue({
          code: 'custom',
          path: [firstResponse],
          message: 'Phản hồi đầu không được lâu hơn thời gian giải quyết',
        });
      }
    }
  });
export type SaveSystemSettingsInput = z.infer<typeof saveSystemSettingsInput>;

// Gia tri da luu bi thieu hoac sai thi dung mac dinh, de them tham so moi khong can sua du lieu.
export function resolveSystemSettings(stored: unknown): SystemSettings {
  const source = typeof stored === 'object' && stored !== null ? stored : {};
  return Object.fromEntries(
    ALL_SETTINGS.map(({ key, defaultValue }) => {
      const parsed = SETTING_FIELDS[key].safeParse((source as Record<string, unknown>)[key]);
      return [key, parsed.success ? parsed.data : defaultValue];
    }),
  ) as SystemSettings;
}

export type SystemSettingsView = { values: SystemSettings; updatedAt: string };

export const DEALER_CODE_SEQUENCE_KEY = 'dealer';

const MAX_SEQUENCE_VALUE = 999_999_999;

export const CODE_SEQUENCE_LIMITS = { minDigits: 3, maxDigits: 9 } as const;

export const saveCodeSequenceInput = z
  .object({
    expectedUpdatedAt: z.iso.datetime(),
    prefix: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9]{1,10}$/, 'Tiền tố gồm 1 đến 10 ký tự: chữ không dấu hoặc số'),
    digits: integerInRange(CODE_SEQUENCE_LIMITS.minDigits, CODE_SEQUENCE_LIMITS.maxDigits),
    rangeStart: integerInRange(1, MAX_SEQUENCE_VALUE),
    rangeEnd: integerInRange(1, MAX_SEQUENCE_VALUE),
  })
  .superRefine(({ digits, rangeStart, rangeEnd }, context) => {
    if (rangeStart > rangeEnd) {
      context.addIssue({
        code: 'custom',
        path: ['rangeEnd'],
        message: 'Số cuối dải phải lớn hơn hoặc bằng số đầu dải',
      });
    }
    if (rangeEnd >= 10 ** digits) {
      context.addIssue({
        code: 'custom',
        path: ['rangeEnd'],
        message: `Số cuối dải không vừa ${digits} chữ số`,
      });
    }
  });
export type SaveCodeSequenceInput = z.infer<typeof saveCodeSequenceInput>;

export type CodeSequenceView = {
  prefix: string;
  digits: number;
  rangeStart: number;
  rangeEnd: number;
  nextValue: number;
  updatedAt: string;
};

export function formatSequenceCode(prefix: string, digits: number, value: number): string {
  return `${prefix}${String(value).padStart(digits, '0')}`;
}

export function issuedCodeCount({
  rangeStart,
  nextValue,
}: Pick<CodeSequenceView, 'rangeStart' | 'nextValue'>): number {
  return nextValue - rangeStart;
}

export type SettingsOverview = {
  settings: SystemSettingsView;
  codeSequence: CodeSequenceView;
};
