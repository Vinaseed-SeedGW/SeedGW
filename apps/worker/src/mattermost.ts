import { db } from '@dms/db/client';

// Gửi tin vào kênh Mattermost qua đường dẫn nhận tin (incoming webhook) của IT.
// Để trống MATTERMOST_WEBHOOK_URL là tắt: chỉ ghi nhật ký, không gửi.

const TIMEOUT_MS = 10_000;

export type MattermostJob = { key: string; text: string };

export function mattermostEnabled(): boolean {
  return Boolean(process.env.MATTERMOST_WEBHOOK_URL?.trim());
}

/** Ghi nhật ký trước khi gửi; khoá trùng nghĩa là đã xếp gửi rồi thì bỏ qua (chống gửi trùng). */
export async function recordMattermost(job: MattermostJob): Promise<boolean> {
  try {
    await db.integrationLog.create({
      data: {
        provider: 'MATTERMOST',
        idempotencyKey: job.key,
        status: mattermostEnabled() ? 'PENDING' : 'SKIPPED',
        payload: { text: job.text },
      },
    });
    return true;
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') return false;
    throw error;
  }
}

/** Một lần gửi; lỗi thì ném ra để BullMQ thử lại, mỗi lần đều ghi số lần thử và lỗi cuối. */
export async function sendMattermost(job: MattermostJob): Promise<void> {
  const url = process.env.MATTERMOST_WEBHOOK_URL?.trim();
  if (!url) return;
  const log = await db.integrationLog.findUnique({
    where: { idempotencyKey: job.key },
    select: { status: true },
  });
  if (log?.status === 'SENT') return;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: job.text }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Mattermost trả mã ${response.status}`);
    await db.integrationLog.update({
      where: { idempotencyKey: job.key },
      data: { status: 'SENT', sentAt: new Date(), attempts: { increment: 1 }, lastError: null },
    });
  } catch (error) {
    await db.integrationLog.update({
      where: { idempotencyKey: job.key },
      data: {
        status: 'FAILED',
        attempts: { increment: 1 },
        lastError: (error instanceof Error ? error.message : String(error)).slice(0, 500),
      },
    });
    throw error;
  }
}
