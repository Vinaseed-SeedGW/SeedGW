'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import type { ActionResult, ExportedFile } from '@seedgw/contracts/common';
import { salesTargetMonth } from '@seedgw/contracts/sales-targets';
import {
  assignTargetInput,
  removeTargetInput,
  type TargetImportResult,
} from '@seedgw/contracts/target-assignments';
import { MAX_IMPORT_FILE_BYTES } from '@seedgw/contracts/user-import';
import { toActionError, validationError } from '@/server/auth/action-error';
import { assertCan } from '@/server/auth/can';
import { requireUser } from '@/server/auth/current-user';
import { getClientIp, writeAudit, writeAuditMany } from '@/server/services/audit';
import {
  assignTarget,
  buildAssignmentTemplate,
  importAssignments,
  removeAssignment,
} from '@/server/services/target-assignments';

export async function assignTargetAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    assertCan(user, 'sales.target.assign');
    const parsed = assignTargetInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);
    const [outcome, ip] = await Promise.all([assignTarget(user.id, parsed.data), getClientIp()]);
    after(() =>
      writeAudit({
        actor: user,
        action: 'sales-target.assign',
        entityType: 'SalesTarget',
        entityId: outcome.id,
        entityLabel: outcome.label,
        changes: outcome.changes,
        ip,
      }),
    );
    revalidatePath('/kinh-doanh/chi-tieu');
    return { ok: true, data: { id: outcome.id } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function removeTargetAction(raw: unknown): Promise<ActionResult<null>> {
  try {
    const user = await requireUser();
    assertCan(user, 'sales.target.assign');
    const parsed = removeTargetInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);
    const [outcome, ip] = await Promise.all([removeAssignment(parsed.data.id), getClientIp()]);
    after(() =>
      writeAudit({
        actor: user,
        action: 'sales-target.unassign',
        entityType: 'SalesTarget',
        entityId: outcome.id,
        entityLabel: outcome.label,
        changes: outcome.changes,
        ip,
      }),
    );
    revalidatePath('/kinh-doanh/chi-tieu');
    return { ok: true, data: null };
  } catch (error) {
    return toActionError(error);
  }
}

export async function downloadAssignmentTemplateAction(
  month: unknown,
): Promise<ActionResult<ExportedFile>> {
  try {
    const user = await requireUser();
    assertCan(user, 'sales.target.assign');
    const parsed = salesTargetMonth.safeParse(month);
    if (!parsed.success) return validationError(parsed.error);
    return { ok: true, data: await buildAssignmentTemplate(parsed.data) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function importAssignmentsAction(
  formData: FormData,
): Promise<ActionResult<TargetImportResult>> {
  try {
    const user = await requireUser();
    assertCan(user, 'sales.target.assign');
    const file = formData.get('file');
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, code: 'VALIDATION', message: 'Vui lòng chọn file Excel' };
    }
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      return { ok: false, code: 'VALIDATION', message: 'File quá lớn, tối đa 900 KB' };
    }
    const [result, ip] = await Promise.all([
      importAssignments(user.id, await file.arrayBuffer()),
      getClientIp(),
    ]);
    if (result.outcomes.length > 0) {
      after(() =>
        writeAuditMany(
          result.outcomes.map((outcome) => ({
            actor: user,
            action: 'sales-target.import' as const,
            entityType: 'SalesTarget' as const,
            entityId: outcome.id,
            entityLabel: outcome.label,
            changes: outcome.changes,
            ip,
          })),
        ),
      );
      revalidatePath('/kinh-doanh/chi-tieu');
    }
    return { ok: true, data: { applied: result.applied, errors: result.errors } };
  } catch (error) {
    return toActionError(error);
  }
}
