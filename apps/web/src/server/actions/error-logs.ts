'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import type { ActionResult } from '@seedgw/contracts/common';
import { resolveErrorLogsInput } from '@seedgw/contracts/error-logs';
import { db } from '@seedgw/db/client';
import { toActionError, validationError } from '@/server/auth/action-error';
import { assertCan } from '@/server/auth/can';
import { requireUser } from '@/server/auth/current-user';
import { getClientIp, writeAudit } from '@/server/services/audit';

/** F9: đánh dấu lỗi đã xử lý. Gặp lại lỗi đó thì tự mở lại. */
export async function resolveErrorLogsAction(
  raw: unknown,
): Promise<ActionResult<{ count: number }>> {
  try {
    const user = await requireUser();
    assertCan(user, 'admin.error-log.read');
    const parsed = resolveErrorLogsInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);
    const rows = await db.errorLog.findMany({
      where: { id: { in: parsed.data.ids }, resolvedAt: null },
      select: { id: true, message: true },
    });
    await db.errorLog.updateMany({
      where: { id: { in: rows.map((row) => row.id) } },
      data: { resolvedAt: new Date() },
    });
    const ip = await getClientIp();
    after(() =>
      Promise.all(
        rows.map((row) =>
          writeAudit({
            actor: user,
            action: 'error-log.resolve',
            entityType: 'ErrorLog',
            entityId: row.id,
            entityLabel: row.message.slice(0, 120),
            changes: { 'Trạng thái': { before: 'Chưa xử lý', after: 'Đã xử lý' } },
            ip,
          }),
        ),
      ),
    );
    revalidatePath('/quan-tri/loi-he-thong');
    return { ok: true, data: { count: rows.length } };
  } catch (error) {
    return toActionError(error);
  }
}
