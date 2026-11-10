'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import type { AuditAction } from '@dms/contracts/audit';
import type { ActionResult } from '@dms/contracts/common';
import { createRoleInput, deleteRoleInput, saveRoleMatrixInput } from '@dms/contracts/roles';
import { toActionError, validationError } from '@/server/auth/action-error';
import { assertCan } from '@/server/auth/can';
import { requireUser, type CurrentUser } from '@/server/auth/current-user';
import { getClientIp, writeAudit } from '@/server/services/audit';
import { createRole, deleteRole, saveRoleMatrix, type RoleOutcome } from '@/server/services/roles';

async function requireRoleManager(): Promise<CurrentUser> {
  const user = await requireUser();
  assertCan(user, 'admin.role.manage');
  return user;
}

async function recordChanges(
  user: CurrentUser,
  action: AuditAction,
  outcomes: readonly RoleOutcome[],
) {
  const ip = await getClientIp();
  after(() =>
    Promise.all(
      outcomes.map((outcome) =>
        writeAudit({
          actor: user,
          action,
          entityType: 'Role',
          entityId: outcome.id,
          entityLabel: outcome.label,
          changes: outcome.changes,
          ip,
        }),
      ),
    ),
  );
  revalidatePath('/quan-tri/vai-tro');
}

export async function saveRoleMatrixAction(
  raw: unknown,
): Promise<ActionResult<{ savedCount: number }>> {
  try {
    const user = await requireRoleManager();
    const parsed = saveRoleMatrixInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);

    const outcomes = await saveRoleMatrix(user, parsed.data);
    await recordChanges(user, 'role.update', outcomes);
    return { ok: true, data: { savedCount: outcomes.length } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function createRoleAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireRoleManager();
    const parsed = createRoleInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);

    const outcome = await createRole(parsed.data);
    await recordChanges(user, 'role.create', [outcome]);
    return { ok: true, data: { id: outcome.id } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteRoleAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireRoleManager();
    const parsed = deleteRoleInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);

    const outcome = await deleteRole(parsed.data.id);
    await recordChanges(user, 'role.delete', [outcome]);
    return { ok: true, data: { id: outcome.id } };
  } catch (error) {
    return toActionError(error);
  }
}
