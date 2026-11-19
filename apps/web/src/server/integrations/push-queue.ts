import 'server-only';
import { randomUUID } from 'node:crypto';
import { Queue } from 'bullmq';
import {
  PUSH_QUEUE,
  type PushKind,
  type PushSendJob,
  type PushTarget,
} from '@seedgw/contracts/push';
import { db } from '@seedgw/db/client';

// Thông báo đẩy (M7): ghi nhật ký rồi đẩy vào hàng đợi, worker gửi qua Expo. Lỗi chỉ ghi log,
// không bao giờ làm hỏng thao tác chính (duyệt tuyến, trả lời hỗ trợ).

export type PushNotice = {
  userId: string;
  kind: PushKind;
  title: string;
  body: string;
  target: PushTarget;
  /** Khoá việc, ví dụ "route-approved:TV00012". Cùng khoá và người nhận thì chỉ gửi một lần. */
  key: string;
};

let queue: Queue | null = null;

function pushQueue(): Queue | null {
  const url = process.env.REDIS_URL?.trim();
  if (!url) return null;
  queue ??= new Queue(PUSH_QUEUE, { connection: { url, maxRetriesPerRequest: null } });
  return queue;
}

export async function notifyUsers(notices: readonly PushNotice[]): Promise<void> {
  if (notices.length === 0) return;
  try {
    const rows = notices.map((notice) => ({
      id: randomUUID(),
      userId: notice.userId,
      kind: notice.kind,
      title: notice.title,
      body: notice.body,
      data: { kind: notice.kind, target: notice.target },
      idempotencyKey: `${notice.key}:${notice.userId}`,
    }));
    await db.pushMessage.createMany({ data: rows, skipDuplicates: true });
    // Dòng bị bỏ do trùng khoá thì không có trong bảng với id vừa tạo, nên không gửi lại.
    const inserted = await db.pushMessage.findMany({
      where: { id: { in: rows.map((row) => row.id) } },
      select: { id: true },
    });
    const target = pushQueue();
    if (!target || inserted.length === 0) return;
    const job: PushSendJob = { messageIds: inserted.map((row) => row.id) };
    await target.add('send', job, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 30_000 },
      removeOnComplete: 1000,
      removeOnFail: 1000,
    });
  } catch (error) {
    console.error('Không xếp được thông báo đẩy', error);
  }
}
