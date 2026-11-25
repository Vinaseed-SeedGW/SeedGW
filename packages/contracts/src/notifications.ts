import { z } from 'zod';
import { canAccessPath } from './access';
import { pushTarget, type PushKind, type PushTarget } from './push';

// D4: trung tâm thông báo. Mỗi thông báo đẩy (M7) cũng là một dòng xem lại được trên web và app.

export const NOTIFICATION_KIND_LABEL: Record<PushKind, string> = {
  SUPPORT_REPLY: 'Hỗ trợ',
  SUPPORT_STATUS: 'Hỗ trợ',
  APPROVAL_PENDING: 'Cần duyệt',
  ROUTE_APPROVED: 'Tuyến',
  ROUTE_RETURNED: 'Tuyến',
  LOCATION_APPROVED: 'Toạ độ',
  LOCATION_REJECTED: 'Toạ độ',
  CHECK_IN_REMINDER: 'Nhắc việc',
  DEALER_PROPOSAL_REVIEWED: 'Đại lý mới',
};

export type NotificationItem = {
  id: string;
  kind: PushKind;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  /** Trang web mở khi bấm; null khi việc này chỉ xem trên app. */
  href: string | null;
};

export type NotificationPage = {
  items: NotificationItem[];
  total: number;
  unread: number;
  page: number;
  pageSize: number;
};

export const NOTIFICATION_PAGE_SIZE = 30;

export const notificationsUrlParams = z
  .object({
    trang: z.coerce.number().int().positive().max(100_000).catch(1),
    xem: z.enum(['chua-doc']).optional().catch(undefined),
  })
  .transform((url) => ({ page: url.trang, unreadOnly: url.xem === 'chua-doc' }));

export const markNotificationsReadInput = z.union([
  z.object({ all: z.literal(true) }),
  z.object({ ids: z.array(z.uuid()).min(1).max(100) }),
]);
export type MarkNotificationsReadInput = z.infer<typeof markNotificationsReadInput>;

/** Đọc màn đích từ dữ liệu thông báo; dữ liệu cũ sai dạng thì không có đích. */
export function readPushTarget(data: unknown): PushTarget | null {
  if (typeof data !== 'object' || data === null || !('target' in data)) return null;
  const parsed = pushTarget.safeParse(data.target);
  return parsed.success ? parsed.data : null;
}

/** Trang web tương ứng màn đích trên app, chỉ khi người nhận mở được trang đó. */
export function notificationWebHref(
  target: PushTarget | null,
  permissions: ReadonlySet<string>,
): string | null {
  if (!target) return null;
  const href = (() => {
    switch (target.screen) {
      case 'support':
        return `/quan-tri/ho-tro/${encodeURIComponent(target.code)}`;
      case 'approvals':
        return '/kinh-doanh/can-duyet';
      case 'routes':
        return '/kinh-doanh/tuyen-vieng-tham';
      case 'today':
      case 'nearby':
        return '/kinh-doanh/check-in';
      case 'dealer-proposals':
        return '/quan-tri/dai-ly/dai-ly-moi';
    }
  })();
  return canAccessPath(permissions, href.split('?')[0] ?? href) ? href : null;
}

// ---------- App điện thoại ----------

export type MobileNotificationItem = Omit<NotificationItem, 'href'> & { target: PushTarget | null };

export type MobileNotificationPage = Omit<NotificationPage, 'items'> & {
  items: MobileNotificationItem[];
};

export const mobileNotificationsQuery = z.object({
  page: z.coerce.number().int().positive().max(100_000).catch(1),
});
