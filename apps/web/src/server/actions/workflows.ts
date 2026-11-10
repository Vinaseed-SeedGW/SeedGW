'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import type { ApprovalChain } from '@dms/contracts/approval-engine';
import type { AuditAction, AuditChanges, AuditEntityType } from '@dms/contracts/audit';
import type { ActionResult } from '@dms/contracts/common';
import {
  createDelegationInput,
  inheritWorkflowInput,
  previewApprovalInput,
  publishWorkflowInput,
  revokeDelegationInput,
} from '@dms/contracts/workflows';
import { toActionError, validationError } from '@/server/auth/action-error';
import { assertCan } from '@/server/auth/can';
import { requireUser, type CurrentUser } from '@/server/auth/current-user';
import { getClientIp, writeAudit } from '@/server/services/audit';
import { createDelegation, revokeDelegation } from '@/server/services/delegations';
import {
  inheritWorkflow,
  publishWorkflow,
  resolveApprovalChain,
} from '@/server/services/workflows';

const WORKFLOWS_PATH = '/quan-tri/quy-trinh-duyet';

async function requireWorkflowManager(): Promise<CurrentUser> {
  const user = await requireUser();
  assertCan(user, 'admin.workflow.manage');
  return user;
}

type Outcome = { id: string; label: string; changes: AuditChanges };

async function recordChange(
  user: CurrentUser,
  action: AuditAction,
  entityType: AuditEntityType,
  outcome: Outcome,
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
  revalidatePath(WORKFLOWS_PATH, 'layout');
}

export async function publishWorkflowAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireWorkflowManager();
    const parsed = publishWorkflowInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);

    const outcome = await publishWorkflow(user, parsed.data);
    await recordChange(user, 'workflow.publish', 'ApprovalWorkflow', outcome);
    return { ok: true, data: { id: outcome.id } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function inheritWorkflowAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireWorkflowManager();
    const parsed = inheritWorkflowInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);

    const outcome = await inheritWorkflow(parsed.data);
    await recordChange(user, 'workflow.inherit', 'ApprovalWorkflow', outcome);
    return { ok: true, data: { id: outcome.id } };
  } catch (error) {
    return toActionError(error);
  }
}

export type ApprovalPreview = {
  sourceUnitName: string;
  isInherited: boolean;
  isDraft: boolean;
  chain: ApprovalChain;
} | null;

export async function previewApprovalAction(raw: unknown): Promise<ActionResult<ApprovalPreview>> {
  try {
    const user = await requireUser();
    assertCan(user, 'admin.workflow.read');
    const parsed = previewApprovalInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);

    const { draft, productGroup, ...facts } = parsed.data;
    const preview = await resolveApprovalChain(
      { ...facts, productGroups: productGroup ? [productGroup] : [] },
      draft,
    );
    return { ok: true, data: preview };
  } catch (error) {
    return toActionError(error);
  }
}

export async function createDelegationAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireWorkflowManager();
    const parsed = createDelegationInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);

    const outcome = await createDelegation(user, parsed.data);
    await recordChange(user, 'delegation.create', 'Delegation', outcome);
    return { ok: true, data: { id: outcome.id } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function revokeDelegationAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireWorkflowManager();
    const parsed = revokeDelegationInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);

    const outcome = await revokeDelegation(parsed.data.id);
    await recordChange(user, 'delegation.revoke', 'Delegation', outcome);
    return { ok: true, data: { id: outcome.id } };
  } catch (error) {
    return toActionError(error);
  }
}
