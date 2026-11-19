import { randomUUID } from 'node:crypto';
import { ANDROID_PUSH_CHANNEL, type PushReceiptJob } from '@seedgw/contracts/push';
import { mondayOf } from '@seedgw/contracts/route-plans';
import { resolveSystemSettings } from '@seedgw/contracts/settings';
import { db } from '@seedgw/db/client';

// Gửi thông báo đẩy qua dịch vụ đẩy của Expo (M7). Expo chuyển tiếp sang Google (Android) và Apple (iPhone).
// EXPO_ACCESS_TOKEN là tuỳ chọn, bật "Push security" trên tài khoản Expo thì bắt buộc.

const SEND_URL = 'https://exp.host/--/api/v2/push/send';
const RECEIPT_URL = 'https://exp.host/--/api/v2/push/getReceipts';
const CHUNK = 100;
const TIMEOUT_MS = 20_000;

type Ticket =
  | { status: 'ok'; id: string }
  | { status: 'error'; message?: string; details?: { error?: string } };
type Receipt =
  { status: 'ok' } | { status: 'error'; message?: string; details?: { error?: string } };

/** Lỗi tạm thời (mạng, Expo trả 5xx): ném ra để BullMQ thử lại. */
export class PushRetryError extends Error {}

function headers(): Record<string, string> {
  const token = process.env.EXPO_ACCESS_TOKEN?.trim();
  return {
    accept: 'application/json',
    'accept-encoding': 'gzip, deflate',
    'content-type': 'application/json',
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
}

async function post<T>(url: string, body: unknown, fetchImpl: typeof fetch): Promise<T> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    throw new PushRetryError(
      `Không gọi được dịch vụ đẩy Expo: ${error instanceof Error ? error.message : error}`,
    );
  }
  if (response.status >= 500 || response.status === 429) {
    throw new PushRetryError(`Dịch vụ đẩy Expo trả mã ${response.status}`);
  }
  const json = (await response.json().catch(() => null)) as { data?: T; errors?: unknown } | null;
  if (!response.ok || !json?.data) {
    throw new Error(
      `Dịch vụ đẩy Expo từ chối (${response.status}): ${JSON.stringify(json?.errors ?? null).slice(0, 300)}`,
    );
  }
  return json.data;
}

async function dropToken(token: string, reason: string): Promise<void> {
  const removed = await db.pushToken.deleteMany({ where: { token } });
  if (removed.count > 0) console.log(`Thông báo: bỏ mã ${token.slice(0, 24)}... (${reason})`);
}

/** Gửi các thông báo đang chờ; trả các vé để kiểm biên nhận sau. */
export async function sendPushMessages(
  messageIds: readonly string[],
  fetchImpl: typeof fetch = fetch,
): Promise<{ sent: number; noToken: number; failed: number; receipts: PushReceiptJob['tickets'] }> {
  const messages = await db.pushMessage.findMany({
    where: { id: { in: [...messageIds] }, status: { in: ['PENDING', 'FAILED'] } },
    select: { id: true, userId: true, title: true, body: true, data: true },
  });
  const tokens = await db.pushToken.findMany({
    where: { userId: { in: [...new Set(messages.map((m) => m.userId))] } },
    select: { token: true, userId: true },
  });
  const byUser = new Map<string, string[]>();
  for (const row of tokens) byUser.set(row.userId, [...(byUser.get(row.userId) ?? []), row.token]);

  const result = { sent: 0, noToken: 0, failed: 0, receipts: [] as PushReceiptJob['tickets'] };
  const outgoing: Array<{ messageId: string; token: string; payload: Record<string, unknown> }> =
    [];
  for (const message of messages) {
    const userTokens = byUser.get(message.userId) ?? [];
    if (userTokens.length === 0) {
      await db.pushMessage.update({
        where: { id: message.id },
        data: { status: 'NO_TOKEN', attempts: { increment: 1 } },
      });
      result.noToken += 1;
      continue;
    }
    for (const token of userTokens) {
      outgoing.push({
        messageId: message.id,
        token,
        payload: {
          to: token,
          title: message.title,
          body: message.body,
          data: message.data,
          sound: 'default',
          priority: 'high',
          channelId: ANDROID_PUSH_CHANNEL.id,
        },
      });
    }
  }

  const okByMessage = new Map<string, number>();
  const errorByMessage = new Map<string, string>();
  for (let start = 0; start < outgoing.length; start += CHUNK) {
    const chunk = outgoing.slice(start, start + CHUNK);
    const tickets = await post<Ticket[]>(
      SEND_URL,
      chunk.map((item) => item.payload),
      fetchImpl,
    );
    for (const [index, item] of chunk.entries()) {
      const ticket = tickets[index];
      if (ticket?.status === 'ok') {
        okByMessage.set(item.messageId, (okByMessage.get(item.messageId) ?? 0) + 1);
        result.receipts.push({ ticketId: ticket.id, token: item.token });
      } else {
        const code = ticket?.details?.error ?? 'Unknown';
        if (code === 'DeviceNotRegistered')
          await dropToken(item.token, 'máy đã gỡ app hoặc tắt thông báo');
        errorByMessage.set(item.messageId, `${code}: ${ticket?.message ?? ''}`.slice(0, 300));
      }
    }
  }
  const now = new Date();
  for (const message of messages) {
    if (!byUser.get(message.userId)?.length) continue;
    const ok = okByMessage.get(message.id) ?? 0;
    await db.pushMessage.update({
      where: { id: message.id },
      data: {
        status: ok > 0 ? 'SENT' : 'FAILED',
        sentAt: ok > 0 ? now : null,
        error: ok > 0 ? null : (errorByMessage.get(message.id) ?? 'Không gửi được'),
        attempts: { increment: 1 },
      },
    });
    if (ok > 0) result.sent += 1;
    else result.failed += 1;
  }
  return result;
}

/** Kiểm biên nhận: máy nào Google, Apple báo không còn nhận được thì xoá mã. */
export async function checkPushReceipts(
  tickets: PushReceiptJob['tickets'],
  fetchImpl: typeof fetch = fetch,
): Promise<{ checked: number; dropped: number }> {
  let dropped = 0;
  for (let start = 0; start < tickets.length; start += 300) {
    const chunk = tickets.slice(start, start + 300);
    const receipts = await post<Record<string, Receipt>>(
      RECEIPT_URL,
      { ids: chunk.map((t) => t.ticketId) },
      fetchImpl,
    );
    for (const ticket of chunk) {
      const receipt = receipts[ticket.ticketId];
      if (receipt?.status === 'error' && receipt.details?.error === 'DeviceNotRegistered') {
        await dropToken(ticket.token, 'Google hoặc Apple báo máy không còn nhận');
        dropped += 1;
      }
    }
  }
  return { checked: tickets.length, dropped };
}

const VN_OFFSET_MS = 7 * 3_600_000;

/**
 * Nhắc chưa check-in (M7): lịch chạy đầu mỗi giờ thứ Hai tới thứ Bảy, chỉ làm khi đúng giờ ở Tham số.
 * Chỉ nhắc người có tuyến đã duyệt hôm nay (tuyến ngày ưu tiên hơn tuyến tuần) mà chưa check-in lượt nào.
 */
export async function createCheckInReminders(
  now = new Date(),
): Promise<{ day: string; messageIds: string[] }> {
  const local = new Date(now.getTime() + VN_OFFSET_MS);
  const day = local.toISOString().slice(0, 10);
  const row = await db.systemSetting.findUnique({
    where: { key: 'general' },
    select: { value: true },
  });
  const settings = resolveSystemSettings(row?.value);
  if (
    settings.checkInReminderEnabled !== 1 ||
    local.getUTCHours() !== settings.checkInReminderHour
  ) {
    return { day, messageIds: [] };
  }
  const plans = await db.routePlan.findMany({
    where: {
      approvedRevision: { not: null },
      user: { isActive: true },
      OR: [
        { kind: 'DAILY', periodStart: day },
        { kind: 'WEEKLY', periodStart: mondayOf(day) },
      ],
    },
    select: { id: true, userId: true, kind: true, approvedRevision: true },
  });
  // Mỗi người lấy tuyến ngày nếu có, không thì tuyến tuần.
  const chosen = new Map<string, (typeof plans)[number]>();
  for (const plan of plans) {
    const current = chosen.get(plan.userId);
    if (!current || (current.kind === 'WEEKLY' && plan.kind === 'DAILY'))
      chosen.set(plan.userId, plan);
  }
  const dayStart = new Date(`${day}T00:00:00+07:00`);
  const messages = [];
  for (const plan of chosen.values()) {
    const [stops, checkIns] = await Promise.all([
      db.routePlanStop.count({
        where: { planId: plan.id, revision: plan.approvedRevision ?? -1, day },
      }),
      db.checkIn.count({ where: { userId: plan.userId, capturedAt: { gte: dayStart } } }),
    ]);
    if (stops === 0 || checkIns > 0) continue;
    messages.push({
      id: randomUUID(),
      userId: plan.userId,
      kind: 'CHECK_IN_REMINDER',
      title: 'Nhắc check-in',
      body: `Hôm nay bạn có ${stops} điểm trong tuyến, chưa check-in lượt nào.`,
      data: { kind: 'CHECK_IN_REMINDER', target: { screen: 'today' } },
      idempotencyKey: `check-in-reminder:${day}:${plan.userId}`,
    });
  }
  if (messages.length === 0) return { day, messageIds: [] };
  await db.pushMessage.createMany({ data: messages, skipDuplicates: true });
  const inserted = await db.pushMessage.findMany({
    where: { id: { in: messages.map((m) => m.id) } },
    select: { id: true },
  });
  return { day, messageIds: inserted.map((m) => m.id) };
}
