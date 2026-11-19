'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import type { ActionResult } from '@seedgw/contracts/common';
import { saveFastConnectionInput } from '@seedgw/contracts/fast';
import { toActionError, validationError } from '@/server/auth/action-error';
import { assertCan } from '@/server/auth/can';
import { requireUser } from '@/server/auth/current-user';
import { requestFastSync } from '@/server/integrations/fast-sync-queue';
import { getClientIp, writeAudit } from '@/server/services/audit';
import { saveFastConnection, testFastConnection } from '@/server/services/fast';

// Trang Kết nối (A8): chỉ người có quyền Sửa Kết nối (Quản trị hệ thống) mới lưu, kiểm tra, đồng bộ ngay.

export async function saveFastConnectionAction(raw: unknown): Promise<ActionResult<null>> {
  try {
    const user = await requireUser();
    assertCan(user, 'admin.connection.manage');
    const parsed = saveFastConnectionInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);
    const outcome = await saveFastConnection(user.id, parsed.data);
    const ip = await getClientIp();
    after(() =>
      writeAudit({
        actor: user,
        action: 'connection.update',
        entityType: 'IntegrationSetting',
        entityId: outcome.id,
        entityLabel: 'Kết nối FAST',
        changes: outcome.changes,
        ip,
      }),
    );
    revalidatePath('/quan-tri/ket-noi');
    return { ok: true, data: null };
  } catch (error) {
    return toActionError(error);
  }
}

export async function testFastConnectionAction(
  raw: unknown,
): Promise<ActionResult<{ message: string }>> {
  try {
    const user = await requireUser();
    assertCan(user, 'admin.connection.manage');
    const parsed = saveFastConnectionInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);
    return { ok: true, data: { message: await testFastConnection(parsed.data) } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function syncFastNowAction(): Promise<ActionResult<null>> {
  try {
    const user = await requireUser();
    assertCan(user, 'admin.connection.manage');
    await requestFastSync();
    const ip = await getClientIp();
    after(() =>
      writeAudit({
        actor: user,
        action: 'connection.sync',
        entityType: 'IntegrationSetting',
        entityId: 'fast',
        entityLabel: 'Kết nối FAST',
        changes: {},
        ip,
      }),
    );
    return { ok: true, data: null };
  } catch (error) {
    return toActionError(error);
  }
}
