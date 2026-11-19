import { z } from 'zod';

// Thông báo đẩy trên app (M7, 19/11/2026), gửi qua dịch vụ đẩy của Expo. Nội dung ngắn, không kèm chi tiết
// nghiệp vụ, vì thông báo đi qua máy chủ của Expo, Google, Apple.

export const pushKind = z.enum([
  'SUPPORT_REPLY',
  'SUPPORT_STATUS',
  'APPROVAL_PENDING',
  'ROUTE_APPROVED',
  'ROUTE_RETURNED',
  'LOCATION_APPROVED',
  'LOCATION_REJECTED',
  'CHECK_IN_REMINDER',
]);
export type PushKind = z.infer<typeof pushKind>;

/** Bấm thông báo thì app mở màn này. */
export const pushTarget = z.discriminatedUnion('screen', [
  z.object({ screen: z.literal('support'), code: z.string() }),
  z.object({ screen: z.literal('approvals') }),
  z.object({ screen: z.literal('routes') }),
  z.object({ screen: z.literal('nearby') }),
  z.object({ screen: z.literal('today') }),
]);
export type PushTarget = z.infer<typeof pushTarget>;

export const registerPushTokenInput = z.object({
  token: z
    .string()
    .trim()
    .max(200)
    .regex(/^Expo(nent)?PushToken\[[^\]]+\]$/, 'Mã nhận thông báo không đúng dạng'),
  platform: z.enum(['ios', 'android']),
});
export type RegisterPushTokenInput = z.infer<typeof registerPushTokenInput>;

export const unregisterPushTokenInput = z.object({ token: z.string().trim().max(200) });

export const PUSH_QUEUE = 'push';
/** Kiểm biên nhận sau 15 phút để xoá mã của máy đã gỡ app hoặc tắt quyền thông báo. */
export const PUSH_RECEIPT_DELAY_MS = 15 * 60_000;

export type PushSendJob = { messageIds: string[] };
export type PushReceiptJob = { tickets: Array<{ ticketId: string; token: string }> };

/** Kênh thông báo Android, đặt tên tiếng Việt cho người dùng thấy trong Cài đặt. */
export const ANDROID_PUSH_CHANNEL = { id: 'mac-dinh', name: 'Thông báo SeedGW' } as const;
