'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import type { AuditAction } from '@dms/contracts/audit';
import type { ActionResult } from '@dms/contracts/common';
import {
  createOrgUnitInput,
  deleteOrgUnitInput,
  moveOrgUnitInput,
  updateOrgUnitInput,
} from '@dms/contracts/org-units';
import { toActionError, validationError } from '@/server/auth/action-error';
import { assertCan } from '@/server/auth/can';
import { requireUser, type CurrentUser } from '@/server/auth/current-user';
import { getClientIp, writeAudit } from '@/server/services/audit';
import {
  createOrgUnit,
  deleteOrgUnit,
  moveOrgUnit,
  updateOrgUnit,
  type OrgUnitOutcome,
} from '@/server/services/org-units';

async function requireManager(): Promise<CurrentUser> {
  const user = await requireUser();
  assertCan(user, 'admin.org-unit.manage');
  return user;
}

async function recordChange(user: CurrentUser, action: AuditAction, outcome: OrgUnitOutcome) {
  if (Object.keys(outcome.changes).length === 0) return;

  const ip = await getClientIp();
  after(() =>
    writeAudit({
      actor: user,
      action,
      entityType: 'OrgUnit',
      entityId: outcome.id,
      entityLabel: outcome.label,
      changes: outcome.changes,
      ip,
    }),
  );
  revalidatePath('/quan-tri/co-cau-to-chuc');
}

export async function createOrgUnitAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireManager();
    const parsed = createOrgUnitInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);

    const outcome = await createOrgUnit(parsed.data);
    await recordChange(user, 'org-unit.create', outcome);
    return { ok: true, data: { id: outcome.id } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateOrgUnitAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireManager();
    const parsed = updateOrgUnitInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);

    const outcome = await updateOrgUnit(parsed.data);
    await recordChange(user, 'org-unit.update', outcome);
    return { ok: true, data: { id: outcome.id } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function moveOrgUnitAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireManager();
    const parsed = moveOrgUnitInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);

    const outcome = await moveOrgUnit(parsed.data);
    await recordChange(user, 'org-unit.move', outcome);
    return { ok: true, data: { id: outcome.id } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function deleteOrgUnitAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireManager();
    const parsed = deleteOrgUnitInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);

    const outcome = await deleteOrgUnit(parsed.data.id);
    await recordChange(user, 'org-unit.delete', outcome);
    return { ok: true, data: { id: outcome.id } };
  } catch (error) {
    return toActionError(error);
  }
}
