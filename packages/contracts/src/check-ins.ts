import { z } from 'zod';
import { MAX_PAGE_SIZE, pageResult } from './common';
import { parseDisplayDate, vietnamToday } from './format';

// Hợp đồng dữ liệu check-in dùng chung cho app điện thoại, API /api/mobile và trang Báo cáo ghé thăm.

export const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
export const MAX_TRACK_POINTS_PER_BATCH = 500;
// Ngày giờ máy gửi lệch giờ máy chủ quá mức này thì gắn cờ, vẫn ghi nhận (CHECK_IN_PLAN, M5).
export const CLOCK_SKEW_FLAG_MINUTES = 5;
// Dòng check-in giữ 18 tháng (DESIGN_BRIEF quyết định 22), bộ lọc ngày chỉ cho chọn trong khoảng này.
export const CHECK_IN_RETENTION_MONTHS = 18;

// ---------- Đăng nhập app ----------

export const mobilePlatform = z.enum(['ios', 'android']);

export const mobileLoginInput = z.object({
  employeeCode: z.string().trim().min(1, 'Nhập mã nhân viên').max(50),
  password: z.string().min(1, 'Nhập mật khẩu').max(200),
  device: z.object({
    // Mã ngẫu nhiên app tạo lúc cài, lưu trong vùng bảo mật của máy.
    key: z.string().trim().min(16).max(100),
    name: z.string().trim().min(1).max(100),
    platform: mobilePlatform,
  }),
});
export type MobileLoginInput = z.infer<typeof mobileLoginInput>;

export const mobileRefreshInput = z.object({ refreshToken: z.string().min(20).max(200) });

export const mobileProfile = z.object({
  id: z.uuid(),
  employeeCode: z.string(),
  fullName: z.string(),
  orgUnitName: z.string().nullable(),
});
export type MobileProfile = z.infer<typeof mobileProfile>;

export const mobileSession = z.object({
  accessToken: z.string(),
  accessExpiresAt: z.iso.datetime(),
  refreshToken: z.string(),
  user: mobileProfile,
});
export type MobileSession = z.infer<typeof mobileSession>;

// Lý do từ chối đăng nhập app, app dựa vào đây để hiện hướng dẫn phù hợp.
export const mobileAuthReason = z.enum([
  'INVALID_CREDENTIALS',
  'LOCKED',
  'DEVICE_PENDING',
  'DEVICE_REVOKED',
  'MUST_CHANGE_PASSWORD',
  'SESSION_EXPIRED',
]);
export type MobileAuthReason = z.infer<typeof mobileAuthReason>;

// ---------- Check-in ----------

export const checkInPlaceKind = z.enum(['DEALER', 'CUSTOMER', 'OTHER']);
export type CheckInPlaceKind = z.infer<typeof checkInPlaceKind>;

export const CHECK_IN_PLACE_KIND_LABEL: Record<CheckInPlaceKind, string> = {
  DEALER: 'Đại lý',
  CUSTOMER: 'Khách hàng',
  OTHER: 'Điểm khác',
};

export const checkInFlag = z.enum(['MOCKED_LOCATION', 'POOR_ACCURACY', 'CLOCK_SKEW']);
export type CheckInFlag = z.infer<typeof checkInFlag>;

export const CHECK_IN_FLAG_LABEL: Record<CheckInFlag, string> = {
  MOCKED_LOCATION: 'Vị trí từ ứng dụng giả lập',
  POOR_ACCURACY: 'Sai số GPS lớn',
  CLOCK_SKEW: 'Giờ trên máy lệch giờ máy chủ',
};

const latitude = z.number().min(-90).max(90);
const longitude = z.number().min(-180).max(180);

export const createCheckInInput = z
  .object({
    clientId: z.uuid(),
    capturedAt: z.iso.datetime(),
    lat: latitude,
    lng: longitude,
    accuracyM: z.number().nonnegative().max(100_000).nullable(),
    isMocked: z.boolean(),
    placeKind: checkInPlaceKind,
    placeName: z.string().trim().min(1, 'Nhập tên nơi check-in').max(200),
    note: z.string().trim().max(1000).default(''),
    // Địa chỉ app đã in lên ảnh, máy chủ vẫn tự lấy lại để không phụ thuộc dữ liệu từ máy.
    addressOnPhoto: z.string().trim().max(500).nullable().default(null),
  })
  .refine((value) => value.placeKind === 'DEALER' || value.note.length > 0, {
    path: ['note'],
    message: 'Nhập ghi chú khi không check-in tại đại lý',
  });
export type CreateCheckInInput = z.infer<typeof createCheckInInput>;

export const checkInReceipt = z.object({
  id: z.uuid(),
  serverTime: z.iso.datetime(),
  hasPhoto: z.boolean(),
});
export type CheckInReceipt = z.infer<typeof checkInReceipt>;

export const trackPointInput = z.object({
  recordedAt: z.iso.datetime(),
  lat: latitude,
  lng: longitude,
  accuracyM: z.number().nonnegative().max(100_000).nullable(),
  speedMps: z.number().max(1000).nullable(),
  isMocked: z.boolean(),
  isBackground: z.boolean(),
});
export type TrackPointInput = z.infer<typeof trackPointInput>;

export const trackPointsBatchInput = z.object({
  points: z.array(trackPointInput).min(1).max(MAX_TRACK_POINTS_PER_BATCH),
});
export type TrackPointsBatchInput = z.infer<typeof trackPointsBatchInput>;

export const trackSessionEndReason = z.enum(['USER', 'AUTO_CUTOFF']);

export const trackSessionInput = z.object({
  clientId: z.uuid(),
  startedAt: z.iso.datetime(),
  endedAt: z.iso.datetime().nullable(),
  endReason: trackSessionEndReason.nullable(),
});
export type TrackSessionInput = z.infer<typeof trackSessionInput>;

export const addressQuery = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

export const addressResult = z.object({ address: z.string().nullable() });

// ---------- Báo cáo ghé thăm trên web ----------

export const checkInRow = z.object({
  id: z.uuid(),
  orgUnitName: z.string().nullable(),
  employeeCode: z.string(),
  employeeName: z.string(),
  capturedAt: z.iso.datetime(),
  address: z.string().nullable(),
  lat: z.number(),
  lng: z.number(),
  accuracyM: z.number().nullable(),
  placeKind: checkInPlaceKind,
  placeName: z.string(),
  note: z.string(),
  roadDistanceKm: z.number().nullable(),
  gpsDistanceKm: z.number().nullable(),
  isDistanceEstimated: z.boolean(),
  flags: z.array(checkInFlag),
  photoUrl: z.string().nullable(),
});
export type CheckInRow = z.infer<typeof checkInRow>;

export const listCheckInsInput = z.object({
  from: z.iso.date(),
  to: z.iso.date(),
  q: z.string().trim().max(100).optional(),
  placeKind: checkInPlaceKind.optional(),
  flaggedOnly: z.boolean().default(false),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(MAX_PAGE_SIZE).default(20),
});
export type ListCheckInsInput = z.infer<typeof listCheckInsInput>;

export const listCheckInsResult = pageResult(checkInRow).extend({
  totalGpsDistanceKm: z.number(),
});
export type ListCheckInsResult = z.infer<typeof listCheckInsResult>;

const CHECK_IN_PAGE_SIZE = 20;

const dateParam = z
  .string()
  .transform((value) => parseDisplayDate(value) ?? undefined)
  .optional()
  .catch(undefined);

/** Ngày sớm nhất được chọn trong bộ lọc, theo thời gian lưu dòng check-in. */
export function earliestCheckInDate(today: string): string {
  const [year, month, day] = today.split('-').map(Number);
  const date = new Date(
    Date.UTC(year ?? 1970, (month ?? 1) - 1 - CHECK_IN_RETENTION_MONTHS, day ?? 1),
  );
  return date.toISOString().slice(0, 10);
}

// Đổi tham số tiếng Việt trên URL sang đầu vào của query. Mặc định xem hôm nay.
export function checkInsUrlParams(now: Date = new Date()) {
  return z
    .object({
      q: z.string().trim().max(100).optional().catch(undefined),
      'tu-ngay': dateParam,
      'den-ngay': dateParam,
      'loai-diem': checkInPlaceKind.optional().catch(undefined),
      'co-co': z.enum(['1']).optional().catch(undefined),
      trang: z.coerce.number().int().positive().max(1_000_000).catch(1),
    })
    .transform((url): ListCheckInsInput => {
      const today = vietnamToday(now);
      const earliest = earliestCheckInDate(today);
      const clamp = (value: string) =>
        value < earliest ? earliest : value > today ? today : value;
      const start = clamp(url['tu-ngay'] ?? today);
      const end = clamp(url['den-ngay'] ?? url['tu-ngay'] ?? today);
      return {
        q: url.q || undefined,
        from: start <= end ? start : end,
        to: start <= end ? end : start,
        placeKind: url['loai-diem'],
        flaggedOnly: url['co-co'] === '1',
        page: url.trang,
        pageSize: CHECK_IN_PAGE_SIZE,
      };
    });
}

export const exportCheckInsInput = listCheckInsInput.omit({ page: true, pageSize: true });
export type ExportCheckInsInput = z.infer<typeof exportCheckInsInput>;

const kmNumber = new Intl.NumberFormat('vi-VN', {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

/** Km hiển thị 3 chữ số thập phân như mẫu Excel, ví dụ 28,315. */
export function formatKm(value: number): string {
  return kmNumber.format(value);
}
