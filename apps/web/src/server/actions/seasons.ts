'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import type { ActionResult } from '@seedgw/contracts/common';
import { deleteSeasonInput, upsertSeasonInput } from '@seedgw/contracts/seasons';
import { toActionError, validationError } from '@/server/auth/action-error';
import { assertCan } from '@/server/auth/can';
import { requireUser } from '@/server/auth/current-user';
import { getClientIp, writeAudit } from '@/server/services/audit';
import { deleteSeason, upsertSeason } from '@/server/services/seasons';

export async function upsertSeasonAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    assertCan(user, 'admin.season.manage');
    const parsed = upsertSeasonInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);
    const [outcome, ip] = await Promise.all([upsertSeason(parsed.data), getClientIp()]);
    after(() =>
      writeAudit({
        actor: user,
        action: outcome.created ? 'season.create' : 'season.update',
        entityType: 'Season',
        entityId: outcome.id,
        entityLabel: outcome.name,
        changes: outcome.changes,
        ip,
      }),
    );
    revalidatePath('/quan-tri/lich-vu');
    return { ok: true, data: { id: outcome.id } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteSeasonAction(raw: unknown): Promise<ActionResult<null>> {
  try {
    const user = await requireUser();
    assertCan(user, 'admin.season.manage');
    const parsed = deleteSeasonInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);
    const [row, ip] = await Promise.all([deleteSeason(parsed.data.id), getClientIp()]);
    after(() =>
      writeAudit({
        actor: user,
        action: 'season.delete',
        entityType: 'Season',
        entityId: parsed.data.id,
        entityLabel: row.name,
        changes: {},
        ip,
      }),
    );
    revalidatePath('/quan-tri/lich-vu');
    return { ok: true, data: null };
  } catch (error) {
    return toActionError(error);
  }
}
