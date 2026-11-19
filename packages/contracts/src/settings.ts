import { z } from 'zod';
import { HIDDEN_SETTING_KEYS } from './features';

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
    key: 'maxCheckInSpeedKmh',
    label: 'Tốc độ tối đa hợp lý giữa hai lượt check-in (km/h)',
    min: 20,
    max: 300,
    defaultValue: 120,
    hint: 'Tính theo đường chim bay giữa hai lượt liền nhau trong ngày, bỏ qua hai lượt cách nhau dưới 2 km. Vượt mức này thì gắn cờ Di chuyển nhanh bất thường, không chặn check-in.',
  },
  {
    key: 'debtWarningPercent',
    label: 'Ngưỡng cảnh báo công nợ (%)',
    min: 1,
    max: 200,
    defaultValue: 100,
    hint: 'Tính trên hạn mức của đại lý lấy từ FAST. Đại lý vượt ngưỡng hiện ở mục Cần chú ý.',
  },
  {
    key: 'dealerUnvisitedDaysLevel1',
    label: 'Đại lý cấp 1 lâu chưa ghé thăm sau (ngày)',
    min: 1,
    max: 365,
    defaultValue: 14,
    hint: 'Đếm từ lần check-in gần nhất của bất kỳ nhân viên nào tại đại lý; chưa từng ghé thì đếm từ ngày vào danh mục. Bỏ qua đại lý ngừng hoạt động.',
  },
  {
    key: 'dealerUnvisitedDaysLevel2',
    label: 'Đại lý cấp 2 lâu chưa ghé thăm sau (ngày)',
    min: 1,
    max: 365,
    defaultValue: 30,
  },
  {
    key: 'dealerUnvisitedDaysLevel3',
    label: 'Đại lý cấp 3 lâu chưa ghé thăm sau (ngày)',
    min: 1,
    max: 365,
    defaultValue: 45,
  },
] as const satisfies readonly SettingDefinition[];

const FAST_SYNC_SETTINGS = [
  {
    key: 'fastCatalogSyncMinutes',
    label: 'Danh mục đại lý, khách hàng từ FAST (phút)',
    min: 5,
    max: 1440,
    defaultValue: 5,
    hint: 'Tài liệu FAST đề xuất 5 phút. Mỗi lần chỉ lấy khách hàng sửa từ lần trước.',
  },
  {
    key: 'fastStockDebtSyncMinutes',
    label: 'Công nợ đại lý (phút)',
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

// S8 (17/11/2026): nộp sau giờ này vẫn nhận, phiếu gắn nhãn Nộp muộn.
const ROUTE_SETTINGS = [
  {
    key: 'routeWeeklyDeadlineHour',
    label: 'Hạn nộp tuyến tuần (giờ, ngày thứ Sáu tuần trước)',
    min: 0,
    max: 23,
    defaultValue: 17,
    hint: 'Ví dụ 17 là trước 17:00 thứ Sáu của tuần trước tuần đi tuyến.',
  },
  {
    key: 'routeDailyDeadlineHour',
    label: 'Hạn nộp tuyến ngày (giờ, ngày hôm trước)',
    min: 0,
    max: 23,
    defaultValue: 17,
  },
] as const satisfies readonly SettingDefinition[];

// A9b (18/11/2026): áp cho lần tính km từ lúc đổi trở đi, không tính lại các ngày cũ.
const TRACKING_SETTINGS = [
  {
    key: 'trackingAutoStopHour',
    label: 'Giờ tự dừng ghi hành trình (giờ Việt Nam)',
    min: 12,
    max: 23,
    defaultValue: 20,
    hint: 'Sau giờ này app không ghi vị trí nữa. App nhận giờ mới khi mở app có mạng.',
  },
  {
    key: 'trackingIntervalSeconds',
    label: 'Chu kỳ ghi vị trí (giây)',
    min: 5,
    max: 60,
    defaultValue: 5,
    hint: 'Tăng lên thì đỡ tốn pin nhưng vết đi ở đường vòng thô hơn, km theo GPS có thể thấp hơn một chút. App áp từ lần bắt đầu ghi tiếp theo.',
  },
  {
    key: 'gpsMaxAccuracyM',
    label: 'Bỏ điểm GPS có sai số lớn hơn (m)',
    min: 10,
    max: 200,
    defaultValue: 50,
  },
  {
    key: 'gpsStopRadiusM',
    label: 'Bán kính gộp chỗ đứng yên (m)',
    min: 10,
    max: 200,
    defaultValue: 40,
    hint: 'Đứng yên thì GPS nhảy qua lại vài chục mét; các điểm trong bán kính này được gộp thành một để không cộng km giả.',
  },
  {
    key: 'gpsStopMinSeconds',
    label: 'Thời gian đứng yên tối thiểu để gộp (giây)',
    min: 30,
    max: 600,
    defaultValue: 60,
  },
] as const satisfies readonly SettingDefinition[];

// T4 (18/11/2026): thời hạn yêu cầu hỗ trợ tính theo giờ làm việc; Hỏi đáp, Góp ý tính như mức Nhẹ.
const SUPPORT_SETTINGS = [
  {
    key: 'supportWorkStartHour',
    label: 'Giờ bắt đầu làm việc',
    min: 5,
    max: 12,
    defaultValue: 8,
    hint: 'Thời hạn xử lý yêu cầu hỗ trợ chỉ đếm trong giờ làm việc.',
  },
  {
    key: 'supportWorkEndHour',
    label: 'Giờ kết thúc làm việc',
    min: 13,
    max: 22,
    defaultValue: 17,
  },
  {
    key: 'supportWorkDaysPerWeek',
    label: 'Số ngày làm việc trong tuần (5 hoặc 6)',
    min: 5,
    max: 6,
    defaultValue: 5,
    hint: '5 là thứ Hai tới thứ Sáu, 6 là thêm thứ Bảy.',
  },
  {
    key: 'supportFirstResponseHoursBlocker',
    label: 'Báo lỗi chặn công việc: phản hồi đầu trong (giờ làm việc)',
    min: 1,
    max: 72,
    defaultValue: 1,
  },
  {
    key: 'supportResolveHoursBlocker',
    label: 'Báo lỗi chặn công việc: xử lý xong trong (giờ làm việc)',
    min: 1,
    max: 200,
    defaultValue: 4,
  },
  {
    key: 'supportFirstResponseHoursMajor',
    label: 'Báo lỗi ảnh hưởng: phản hồi đầu trong (giờ làm việc)',
    min: 1,
    max: 72,
    defaultValue: 4,
  },
  {
    key: 'supportResolveHoursMajor',
    label: 'Báo lỗi ảnh hưởng: xử lý xong trong (giờ làm việc)',
    min: 1,
    max: 200,
    defaultValue: 18,
  },
  {
    key: 'supportFirstResponseHoursMinor',
    label: 'Lỗi nhẹ, Hỏi đáp, Góp ý: phản hồi đầu trong (giờ làm việc)',
    min: 1,
    max: 72,
    defaultValue: 9,
  },
  {
    key: 'supportResolveHoursMinor',
    label: 'Lỗi nhẹ, Hỏi đáp, Góp ý: xử lý xong trong (giờ làm việc)',
    min: 1,
    max: 200,
    defaultValue: 45,
  },
  {
    key: 'supportDueSoonPercent',
    label: 'Báo sắp quá hạn khi còn lại (% thời hạn)',
    min: 5,
    max: 75,
    defaultValue: 25,
  },
] as const satisfies readonly SettingDefinition[];

// M7 (19/11/2026): nhắc nhân viên có tuyến đã duyệt hôm nay mà tới giờ nhắc chưa check-in lượt nào.
const NOTIFICATION_SETTINGS = [
  {
    key: 'checkInReminderEnabled',
    label: 'Nhắc chưa check-in qua thông báo trên app (1 bật, 0 tắt)',
    min: 0,
    max: 1,
    defaultValue: 1,
    hint: 'Chỉ nhắc người có tuyến đã duyệt hôm nay, từ thứ Hai tới thứ Bảy, mỗi ngày một lần.',
  },
  {
    key: 'checkInReminderHour',
    label: 'Giờ nhắc chưa check-in (giờ Việt Nam)',
    min: 7,
    max: 15,
    defaultValue: 10,
  },
] as const satisfies readonly SettingDefinition[];

const ALL_SETTING_GROUPS = [
  { title: 'Kinh doanh', settings: SALES_SETTINGS },
  { title: 'Tuyến viếng thăm', settings: ROUTE_SETTINGS },
  { title: 'Ghi hành trình và km theo GPS', settings: TRACKING_SETTINGS },
  { title: 'Thời hạn xử lý yêu cầu hỗ trợ', settings: SUPPORT_SETTINGS },
  { title: 'Thông báo trên app', settings: NOTIFICATION_SETTINGS },
  { title: 'Chu kỳ đồng bộ FAST', settings: FAST_SYNC_SETTINGS },
] as const;

/** Nhóm tham số hiện trên trang Tham số; tham số của tính năng đang hold được ẩn (features.ts). */
export const SETTING_GROUPS = ALL_SETTING_GROUPS.map((group) => ({
  title: group.title,
  settings: group.settings.filter((setting) => !HIDDEN_SETTING_KEYS.has(setting.key)),
})).filter((group) => group.settings.length > 0);

const ALL_SETTINGS = [
  ...SALES_SETTINGS,
  ...ROUTE_SETTINGS,
  ...TRACKING_SETTINGS,
  ...SUPPORT_SETTINGS,
  ...NOTIFICATION_SETTINGS,
  ...FAST_SYNC_SETTINGS,
];

export type SettingKey = (typeof ALL_SETTINGS)[number]['key'];
export type SystemSettings = Record<SettingKey, number>;

export const SETTING_LABEL = Object.fromEntries(
  ALL_SETTINGS.map(({ key, label }) => [key, label]),
) as Record<SettingKey, string>;

// Form gui chuoi nen ep kieu ve so, o trong thanh 0 va bi chan boi gia tri nho nhat.
export function integerInRange(min: number, max: number) {
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

export const saveSystemSettingsInput = z.object({
  expectedUpdatedAt: z.iso.datetime(),
  ...SETTING_FIELDS,
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
