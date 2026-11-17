'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import type { ActionResult, ExportedFile } from '@dms/contracts/common';
import { commitManagerImportInput, type ManagerImportPreview } from '@dms/contracts/manager-import';
import { MAX_IMPORT_FILE_BYTES } from '@dms/contracts/user-import';
import { toActionError, validationError } from '@/server/auth/action-error';
import { assertCan } from '@/server/auth/can';
import { requireUser } from '@/server/auth/current-user';
import { syncPendingApprovers } from '@/server/services/approval-sync';
import { getClientIp, writeAuditMany } from '@/server/services/audit';
import {
  buildManagerImportTemplate,
  commitManagerImport,
  parseManagerImportFile,
  previewManagerImport,
} from '@/server/services/manager-import';

export async function downloadManagerImportTemplateAction(): Promise<ActionResult<ExportedFile>> {
  try {
    const user = await requireUser();
    assertCan(user, 'admin.user.manage');
    return { ok: true, data: await buildManagerImportTemplate() };
  } catch (error) {
    return toActionError(error);
  }
}

export async function previewManagerImportAction(
  formData: FormData,
): Promise<ActionResult<ManagerImportPreview>> {
  try {
    const user = await requireUser();
    assertCan(user, 'admin.user.manage');
    const file = formData.get('file');
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, code: 'VALIDATION', message: 'Vui lòng chọn file Excel' };
    }
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      return { ok: false, code: 'VALIDATION', message: 'File quá lớn, tối đa 900 KB' };
    }
    const rows = await parseManagerImportFile(await file.arrayBuffer());
    return { ok: true, data: await previewManagerImport(rows) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function commitManagerImportAction(
  raw: unknown,
): Promise<ActionResult<{ updatedCount: number }>> {
  try {
    const user = await requireUser();
    assertCan(user, 'admin.user.manage');
    const parsed = commitManagerImportInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);

    const [changes, ip] = await Promise.all([commitManagerImport(parsed.data.rows), getClientIp()]);
    after(() =>
      writeAuditMany(
        changes.map((row) => ({
          actor: user,
          action: 'user.update' as const,
          entityType: 'User' as const,
          entityId: row.id,
          entityLabel: row.employeeCode,
          changes: row.changes,
          ip,
        })),
      ),
    );
    if (changes.length > 0) await syncPendingApprovers(user, ip);
    revalidatePath('/quan-tri/tai-khoan', 'layout');
    return { ok: true, data: { updatedCount: changes.length } };
  } catch (error) {
    return toActionError(error);
  }
}
