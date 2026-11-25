'use server';

import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@seedgw/contracts/common';
import { markNotificationsReadInput } from '@seedgw/contracts/notifications';
import { toActionError, validationError } from '@/server/auth/action-error';
import { requireUser } from '@/server/auth/current-user';
import { markRead } from '@/server/services/notifications';

/** Đánh dấu đã đọc thông báo của chính mình. Không ghi nhật ký vì không đổi dữ liệu nghiệp vụ. */
export async function markNotificationsReadAction(
  raw: unknown,
): Promise<ActionResult<{ count: number }>> {
  try {
    const user = await requireUser();
    const parsed = markNotificationsReadInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);
    const count = await markRead(user.id, parsed.data);
    revalidatePath('/', 'layout');
    return { ok: true, data: { count } };
  } catch (error) {
    return toActionError(error);
  }
}
