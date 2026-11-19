'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import type { AuditAction, AuditEntityType } from '@seedgw/contracts/audit';
import type { ActionResult } from '@seedgw/contracts/common';
import { saveCodeSequenceInput, saveSystemSettingsInput } from '@seedgw/contracts/settings';
import { toActionError, validationError } from '@/server/auth/action-error';
import { assertCan } from '@/server/auth/can';
import { requireUser, type CurrentUser } from '@/server/auth/current-user';
import { getClientIp, writeAudit } from '@/server/services/audit';
import {
  saveDealerCodeSequence,
  saveSystemSettings,
  type SettingOutcome,
} from '@/server/services/settings';

async function requireSettingManager(): Promise<CurrentUser> {
  const user = await requireUser();
  assertCan(user, 'admin.setting.manage');
  return user;
}

async function recordChange(
  user: CurrentUser,
  action: AuditAction,
  entityType: AuditEntityType,
  outcome: SettingOutcome,
) {
  if (Object.keys(outcome.changes).length > 0) {
    const ip = await getClientIp();
    after(() =>
      writeAudit({
        actor: user,
        action,
        entityType,
        entityId: outcome.id,
        entityLabel: outcome.label,
        changes: outcome.changes,
        ip,
      }),
    );
  }
  revalidatePath('/quan-tri/tham-so');
}

export async function saveSystemSettingsAction(
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireSettingManager();
    const parsed = saveSystemSettingsInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);

    const outcome = await saveSystemSettings(parsed.data);
    await recordChange(user, 'setting.update', 'SystemSetting', outcome);
    return { ok: true, data: { id: outcome.id } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function saveCodeSequenceAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireSettingManager();
    const parsed = saveCodeSequenceInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);

    const outcome = await saveDealerCodeSequence(parsed.data);
    await recordChange(user, 'code-sequence.update', 'CodeSequence', outcome);
    return { ok: true, data: { id: outcome.id } };
  } catch (error) {
    return toActionError(error);
  }
}
