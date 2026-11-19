'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import type { AuditAction } from '@dms/contracts/audit';
import type { ActionResult } from '@dms/contracts/common';
import {
  changeSupportStatusInput,
  createSupportRequestInput,
  escalateSupportInput,
  listMySupportInput,
  replySupportInput,
  supportCodeInput,
  type SupportDetail,
  type SupportListResult,
} from '@dms/contracts/support';
import { toActionError, validationError } from '@/server/auth/action-error';
import { assertCan } from '@/server/auth/can';
import { requireUser, type CurrentUser } from '@/server/auth/current-user';
import { getScopedDb } from '@/server/auth/scoped-db';
import { getClientIp, writeAudit } from '@/server/services/audit';
import { DomainError } from '@/server/services/domain-error';
import {
  changeSupportStatus,
  claimSupport,
  createSupportRequest,
  escalateSupport,
  listMySupport,
  markSupportRead,
  readSupportButtonSummary,
  readSupportDetail,
  reopenSupport,
  replySupport,
  type SupportButtonSummary,
  type SupportMutation,
  type SupportUpload,
} from '@/server/services/support';

// Hỗ trợ trên web (T2). Khung nút nổi là Client Component nên đọc danh sách, chi tiết qua action.

function revalidateSupport(code?: string) {
  revalidatePath('/quan-tri/ho-tro');
  if (code) revalidatePath(`/quan-tri/ho-tro/${code}`);
}

async function audit(user: CurrentUser, action: AuditAction, outcome: SupportMutation) {
  if (!outcome.created) return;
  const ip = await getClientIp();
  after(() =>
    writeAudit({
      actor: user,
      action,
      entityType: 'SupportRequest',
      entityId: outcome.id,
      entityLabel: outcome.code,
      changes: outcome.changes,
      ip,
    }),
  );
}

/** FormData gồm ô payload (JSON) và các tệp ở ô files. */
async function readForm(form: FormData): Promise<{ payload: unknown; uploads: SupportUpload[] }> {
  const raw = form.get('payload');
  let payload: unknown = null;
  try {
    payload = typeof raw === 'string' ? JSON.parse(raw) : null;
  } catch {
    throw new DomainError('VALIDATION', 'Dữ liệu gửi lên không đúng dạng');
  }
  const files = form
    .getAll('files')
    .filter((item): item is File => item instanceof File && item.size > 0);
  const uploads = await Promise.all(
    files.map(async (file) => ({
      name: file.name,
      bytes: new Uint8Array(await file.arrayBuffer()),
    })),
  );
  return { payload, uploads };
}

// ---------- Đọc cho khung nút nổi ----------

export async function loadMySupportAction(raw: unknown): Promise<ActionResult<SupportListResult>> {
  try {
    const user = await requireUser();
    assertCan(user, 'support.request.create');
    const parsed = listMySupportInput.safeParse(raw ?? {});
    if (!parsed.success) return validationError(parsed.error);
    return { ok: true, data: await listMySupport(user, await getScopedDb(), parsed.data) };
  } catch (error) {
    return toActionError(error);
  }
}

/** Mở một yêu cầu trong khung nút nổi; đánh dấu đã đọc luôn. */
export async function loadSupportDetailAction(raw: unknown): Promise<ActionResult<SupportDetail>> {
  try {
    const user = await requireUser();
    const parsed = supportCodeInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);
    const scoped = await getScopedDb();
    const detail = await readSupportDetail(user, scoped, parsed.data.code, 'presigned');
    await markSupportRead(user, scoped, parsed.data.code);
    return { ok: true, data: { ...detail, unread: false } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function loadSupportButtonSummaryAction(): Promise<
  ActionResult<SupportButtonSummary>
> {
  try {
    const user = await requireUser();
    return { ok: true, data: await readSupportButtonSummary(user, await getScopedDb()) };
  } catch (error) {
    return toActionError(error);
  }
}

export async function markSupportReadAction(raw: unknown): Promise<ActionResult<null>> {
  try {
    const user = await requireUser();
    const parsed = supportCodeInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);
    await markSupportRead(user, await getScopedDb(), parsed.data.code);
    return { ok: true, data: null };
  } catch (error) {
    return toActionError(error);
  }
}

// ---------- Ghi ----------

export async function createSupportRequestAction(
  form: FormData,
): Promise<ActionResult<{ code: string }>> {
  try {
    const user = await requireUser();
    assertCan(user, 'support.request.create');
    const { payload, uploads } = await readForm(form);
    const parsed = createSupportRequestInput.safeParse(payload);
    if (!parsed.success) return validationError(parsed.error);
    const outcome = await createSupportRequest(user, parsed.data, uploads);
    await audit(user, 'support.create', outcome);
    revalidateSupport();
    return {
      ok: true,
      data: { code: outcome.code },
      warnings: outcome.warnings.map((message) => ({ code: 'ATTACHMENT', message })),
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function replySupportAction(form: FormData): Promise<ActionResult<{ code: string }>> {
  try {
    const user = await requireUser();
    const { payload, uploads } = await readForm(form);
    const parsed = replySupportInput.safeParse(payload);
    if (!parsed.success) return validationError(parsed.error);
    const outcome = await replySupport(user, await getScopedDb(), parsed.data, uploads);
    revalidateSupport(outcome.code);
    return {
      ok: true,
      data: { code: outcome.code },
      warnings: outcome.warnings.map((message) => ({ code: 'ATTACHMENT', message })),
    };
  } catch (error) {
    return toActionError(error);
  }
}

export async function claimSupportAction(raw: unknown): Promise<ActionResult<{ code: string }>> {
  try {
    const user = await requireUser();
    assertCan(user, 'support.request.manage');
    const parsed = supportCodeInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);
    const outcome = await claimSupport(user, await getScopedDb(), parsed.data.code);
    await audit(user, 'support.claim', outcome);
    revalidateSupport(outcome.code);
    return { ok: true, data: { code: outcome.code } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function escalateSupportAction(raw: unknown): Promise<ActionResult<{ code: string }>> {
  try {
    const user = await requireUser();
    assertCan(user, 'support.request.manage');
    const parsed = escalateSupportInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);
    const outcome = await escalateSupport(user, await getScopedDb(), parsed.data);
    await audit(user, 'support.escalate', outcome);
    revalidateSupport(outcome.code);
    return { ok: true, data: { code: outcome.code } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function changeSupportStatusAction(
  raw: unknown,
): Promise<ActionResult<{ code: string }>> {
  try {
    const user = await requireUser();
    assertCan(user, 'support.request.manage');
    const parsed = changeSupportStatusInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);
    const outcome = await changeSupportStatus(user, await getScopedDb(), parsed.data);
    await audit(user, 'support.status', outcome);
    revalidateSupport(outcome.code);
    return { ok: true, data: { code: outcome.code } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function reopenSupportAction(raw: unknown): Promise<ActionResult<{ code: string }>> {
  try {
    const user = await requireUser();
    assertCan(user, 'support.request.create');
    const parsed = supportCodeInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);
    const outcome = await reopenSupport(user, await getScopedDb(), parsed.data.code);
    await audit(user, 'support.reopen', outcome);
    revalidateSupport(outcome.code);
    return { ok: true, data: { code: outcome.code } };
  } catch (error) {
    return toActionError(error);
  }
}
