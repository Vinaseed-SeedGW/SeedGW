import 'server-only';
import type { Prisma } from '@prisma/client';
import {
  notificationWebHref,
  readPushTarget,
  type MarkNotificationsReadInput,
  type MobileNotificationItem,
  type MobileNotificationPage,
  type NotificationItem,
  type NotificationPage,
} from '@seedgw/contracts/notifications';
import { pushKind } from '@seedgw/contracts/push';
import { db } from '@seedgw/db/client';

// Thông báo luôn lọc theo đúng người nhận, không theo phạm vi vai trò: Quản trị cũng chỉ thấy của mình.

const SELECT = {
  id: true,
  kind: true,
  title: true,
  body: true,
  data: true,
  readAt: true,
  createdAt: true,
} satisfies Prisma.PushMessageSelect;

type Row = Prisma.PushMessageGetPayload<{ select: typeof SELECT }>;

function toItem(row: Row, permissions: ReadonlySet<string>): NotificationItem | null {
  const kind = pushKind.safeParse(row.kind);
  if (!kind.success) return null;
  return {
    id: row.id,
    kind: kind.data,
    title: row.title,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    read: row.readAt !== null,
    href: notificationWebHref(readPushTarget(row.data), permissions),
  };
}

export async function readNotifications(
  user: { id: string; permissions: ReadonlySet<string> },
  input: { page: number; pageSize: number; unreadOnly: boolean },
): Promise<NotificationPage> {
  const where: Prisma.PushMessageWhereInput = {
    userId: user.id,
    ...(input.unreadOnly ? { readAt: null } : {}),
  };
  const [rows, total, unread] = await Promise.all([
    db.pushMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
      select: SELECT,
    }),
    db.pushMessage.count({ where }),
    countUnread(user.id),
  ]);
  return {
    items: rows.map((row) => toItem(row, user.permissions)).filter((item) => item !== null),
    total,
    unread,
    page: input.page,
    pageSize: input.pageSize,
  };
}

export function countUnread(userId: string): Promise<number> {
  return db.pushMessage.count({ where: { userId, readAt: null } });
}

export async function markRead(userId: string, input: MarkNotificationsReadInput): Promise<number> {
  const { count } = await db.pushMessage.updateMany({
    where: { userId, readAt: null, ...('ids' in input ? { id: { in: input.ids } } : {}) },
    data: { readAt: new Date() },
  });
  return count;
}

/** App: cùng danh sách, kèm màn đích để app mở như khi bấm thông báo đẩy. */
export async function readMobileNotifications(
  userId: string,
  page: number,
  pageSize: number,
): Promise<MobileNotificationPage> {
  const where: Prisma.PushMessageWhereInput = { userId };
  const [rows, total, unread] = await Promise.all([
    db.pushMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: SELECT,
    }),
    db.pushMessage.count({ where }),
    countUnread(userId),
  ]);
  const items: MobileNotificationItem[] = [];
  for (const row of rows) {
    const kind = pushKind.safeParse(row.kind);
    if (!kind.success) continue;
    items.push({
      id: row.id,
      kind: kind.data,
      title: row.title,
      body: row.body,
      createdAt: row.createdAt.toISOString(),
      read: row.readAt !== null,
      target: readPushTarget(row.data),
    });
  }
  return { items, total, unread, page, pageSize };
}
