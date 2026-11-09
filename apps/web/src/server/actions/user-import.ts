'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import type { ActionResult, ExportedFile } from '@dms/contracts/common';
import {
  commitUserImportInput,
  MAX_IMPORT_FILE_BYTES,
  type UserImportPreview,
} from '@dms/contracts/user-import';
import { validationError, toActionError } from '@/server/auth/action-error';
import { assertCan } from '@/server/auth/can';
import { requireUser } from '@/server/auth/current-user';
import { getClientIp, writeAuditMany } from '@/server/services/audit';
import {
  buildUserImportTemplate,
  commitUserImport,
  parseUserImportFile,
  previewUserImport,
} from '@/server/services/user-import';

export async function downloadUserImportTemplateAction(): Promise<ActionResult<ExportedFile>> {
  try {
    const user = await requireUser();
    assertCan(user, 'admin.user.manage');
    return { ok: true, data: await buildUserImportTemplate(user) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function previewUserImportAction(
  formData: FormData,
): Promise<ActionResult<UserImportPreview>> {
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

    const rows = await parseUserImportFile(await file.arrayBuffer());
    return { ok: true, data: await previewUserImport(user, rows) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function commitUserImportAction(
  raw: unknown,
): Promise<ActionResult<{ createdCount: number; file: ExportedFile }>> {
  try {
    const user = await requireUser();
    assertCan(user, 'admin.user.manage');

    const parsed = commitUserImportInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);

    const [{ created, file }, ip] = await Promise.all([
      commitUserImport(user, parsed.data.rows),
      getClientIp(),
    ]);

    after(() =>
      writeAuditMany(
        created.map((row) => ({
          actor: user,
          action: 'user.import' as const,
          entityType: 'User',
          entityId: row.id,
          entityLabel: row.employeeCode,
          changes: row.changes,
          ip,
        })),
      ),
    );
    revalidatePath('/quan-tri/tai-khoan', 'layout');
    return { ok: true, data: { createdCount: created.length, file } };
  } catch (error) {
    return toActionError(error);
  }
}
