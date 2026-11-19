'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import {
  approveDecisionInput,
  bulkApproveInput,
  returnDecisionInput,
  withdrawApprovalInput,
} from '@seedgw/contracts/approvals';
import type { AuditAction } from '@seedgw/contracts/audit';
import type { ActionResult } from '@seedgw/contracts/common';
import { toActionError, validationError } from '@/server/auth/action-error';
import { assertCan, can } from '@/server/auth/can';
import { requireUser, type CurrentUser } from '@/server/auth/current-user';
import {
  approveRequest,
  bulkApprove,
  returnRequest,
  withdrawRequest,
  type ApprovalOutcome,
} from '@/server/services/approvals';
import { getClientIp, writeAuditMany } from '@/server/services/audit';

function revalidateApprovals() {
  revalidatePath('/kinh-doanh/can-duyet', 'layout');
  revalidatePath('/kinh-doanh/chi-tieu');
  revalidatePath('/kinh-doanh/tuyen-vieng-tham', 'layout');
}

function audit(
  user: CurrentUser,
  action: AuditAction,
  outcomes: readonly ApprovalOutcome[],
  ip: string | null,
) {
  after(() =>
    writeAuditMany(
      outcomes.map((outcome) => ({
        actor: user,
        action,
        entityType: 'ApprovalRequest' as const,
        entityId: outcome.requestId,
        entityLabel: outcome.code,
        changes: outcome.changes,
        ip,
      })),
    ),
  );
}

export async function approveApprovalAction(raw: unknown): Promise<ActionResult<{ code: string }>> {
  try {
    const user = await requireUser();
    assertCan(user, 'sales.approval.review');
    const parsed = approveDecisionInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);

    const [outcome, ip] = await Promise.all([
      approveRequest(
        user.id,
        parsed.data.code,
        parsed.data.note,
        new Date(),
        can(user, 'sales.approval.override'),
      ),
      getClientIp(),
    ]);
    audit(user, 'approval.approve', [outcome], ip);
    revalidateApprovals();
    return { ok: true, data: { code: outcome.code } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function returnApprovalAction(raw: unknown): Promise<ActionResult<{ code: string }>> {
  try {
    const user = await requireUser();
    assertCan(user, 'sales.approval.review');
    const parsed = returnDecisionInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);

    const [outcome, ip] = await Promise.all([
      returnRequest(
        user.id,
        parsed.data.code,
        parsed.data.reason,
        new Date(),
        can(user, 'sales.approval.override'),
      ),
      getClientIp(),
    ]);
    audit(user, 'approval.return', [outcome], ip);
    revalidateApprovals();
    return { ok: true, data: { code: outcome.code } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function bulkApproveAction(
  raw: unknown,
): Promise<ActionResult<{ approved: number; failed: Array<{ code: string; message: string }> }>> {
  try {
    const user = await requireUser();
    assertCan(user, 'sales.approval.review');
    const parsed = bulkApproveInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);

    const [result, ip] = await Promise.all([
      bulkApprove(user.id, parsed.data.codes),
      getClientIp(),
    ]);
    audit(user, 'approval.approve', result.approved, ip);
    revalidateApprovals();
    return {
      ok: true,
      data: { approved: result.approved.length, failed: result.failed },
      warnings: result.failed.length
        ? [
            {
              code: 'PARTIAL',
              message: `${result.failed.length} phiếu không duyệt được, xem lý do bên dưới`,
            },
          ]
        : undefined,
    };
  } catch (error) {
    return toActionError(error);
  }
}

/** Người gửi rút lại phiếu khi chưa ai duyệt. Kiểm người gửi ở service, không cần quyền duyệt. */
export async function withdrawApprovalAction(
  raw: unknown,
): Promise<ActionResult<{ code: string }>> {
  try {
    const user = await requireUser();
    if (!can(user, 'sales.target.register')) assertCan(user, 'sales.route.register');
    const parsed = withdrawApprovalInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);

    const [outcome, ip] = await Promise.all([
      withdrawRequest(user.id, parsed.data.code, new Date(), can(user, 'sales.approval.override')),
      getClientIp(),
    ]);
    audit(user, 'approval.withdraw', [outcome], ip);
    revalidateApprovals();
    return { ok: true, data: { code: outcome.code } };
  } catch (error) {
    return toActionError(error);
  }
}
