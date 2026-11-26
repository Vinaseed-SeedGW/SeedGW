'use server';

import { revalidatePath } from 'next/cache';
import type { z } from 'zod';
import { after } from 'next/server';
import type { AuditAction } from '@seedgw/contracts/audit';
import type { ActionResult } from '@seedgw/contracts/common';
import {
  approveDealerProposalInput,
  createDealerWebInput,
  markDuplicateDealerProposalInput,
  rejectDealerProposalInput,
  type CreateDealerWebResult,
} from '@seedgw/contracts/dealer-proposals';
import { toActionError, validationError } from '@/server/auth/action-error';
import { assertCan, can } from '@/server/auth/can';
import { requireUser } from '@/server/auth/current-user';
import { getClientIp, writeAudit } from '@/server/services/audit';
import {
  approveProposal,
  createDealerFromWeb,
  markProposalDuplicate,
  rejectProposal,
  type ProposalOutcome,
} from '@/server/services/dealer-proposals';

type Reviewer = Awaited<ReturnType<typeof requireUser>>;

/** Có quyền duyệt (Quản lý, Lãnh đạo đơn vị) hoặc duyệt thay; service kiểm tiếp có đúng người được giao. */
function assertCanDecide(user: Reviewer): void {
  if (!can(user, 'sales.approval.review')) assertCan(user, 'sales.approval.override');
}

/** Hộp thoại xác nhận chỉ hiện message, không hiện lỗi từng trường: đưa lỗi đầu tiên lên message. */
function dialogValidationError(error: z.ZodError): ActionResult<never> {
  const result = validationError(error);
  const first = error.issues[0]?.message;
  return result.ok || !first ? result : { ...result, message: first };
}

function finish(
  user: Reviewer,
  action: AuditAction,
  outcome: ProposalOutcome,
  ip: string | null,
): ActionResult<{ dealerId: string | null }> {
  after(() =>
    writeAudit({
      actor: user,
      action,
      entityType: outcome.dealerId ? 'Dealer' : 'DealerProposal',
      entityId: outcome.dealerId ?? outcome.proposalId,
      entityLabel: outcome.dealerName,
      changes: outcome.changes,
      ip,
    }),
  );
  revalidatePath('/quan-tri/dai-ly', 'layout');
  revalidatePath('/kinh-doanh/dai-ly', 'layout');
  revalidatePath('/kinh-doanh/can-duyet', 'layout');
  return { ok: true, data: { dealerId: outcome.dealerId } };
}

export async function approveDealerProposalAction(
  raw: unknown,
): Promise<ActionResult<{ dealerId: string | null }>> {
  try {
    const user = await requireUser();
    assertCanDecide(user);
    const parsed = approveDealerProposalInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);
    const [outcome, ip] = await Promise.all([approveProposal(user, parsed.data), getClientIp()]);
    return finish(user, 'dealer.proposal.approve', outcome, ip);
  } catch (error) {
    return toActionError(error);
  }
}

export async function rejectDealerProposalAction(
  raw: unknown,
): Promise<ActionResult<{ dealerId: string | null }>> {
  try {
    const user = await requireUser();
    assertCanDecide(user);
    const parsed = rejectDealerProposalInput.safeParse(raw);
    if (!parsed.success) return dialogValidationError(parsed.error);
    const [outcome, ip] = await Promise.all([rejectProposal(user, parsed.data), getClientIp()]);
    return finish(user, 'dealer.proposal.reject', outcome, ip);
  } catch (error) {
    return toActionError(error);
  }
}

export async function markDuplicateDealerProposalAction(
  raw: unknown,
): Promise<ActionResult<{ dealerId: string | null }>> {
  try {
    const user = await requireUser();
    assertCanDecide(user);
    const parsed = markDuplicateDealerProposalInput.safeParse(raw);
    if (!parsed.success) return dialogValidationError(parsed.error);
    const [outcome, ip] = await Promise.all([
      markProposalDuplicate(user, parsed.data),
      getClientIp(),
    ]);
    return finish(user, 'dealer.proposal.duplicate', outcome, ip);
  } catch (error) {
    return toActionError(error);
  }
}

/**
 * Thêm đại lý trên web (26/11/2026), mọi vai trò có quyền đề xuất đại lý mới. Service quyết định tạo luôn hay
 * chờ duyệt theo người thêm.
 */
export async function createDealerWebAction(
  raw: unknown,
): Promise<ActionResult<CreateDealerWebResult>> {
  try {
    const user = await requireUser();
    if (!can(user, 'admin.dealer-proposal.approve')) assertCan(user, 'sales.dealer.propose');
    const parsed = createDealerWebInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);
    const [{ result, audits }, ip] = await Promise.all([
      createDealerFromWeb(user, parsed.data),
      getClientIp(),
    ]);
    after(async () => {
      for (const { action, outcome } of audits) {
        await writeAudit({
          actor: user,
          action,
          entityType: outcome.dealerId ? 'Dealer' : 'DealerProposal',
          entityId: outcome.dealerId ?? outcome.proposalId,
          entityLabel: outcome.dealerName,
          changes: outcome.changes,
          ip,
        });
      }
    });
    revalidatePath('/quan-tri/dai-ly', 'layout');
    revalidatePath('/kinh-doanh/dai-ly', 'layout');
    revalidatePath('/kinh-doanh/can-duyet', 'layout');
    return { ok: true, data: result };
  } catch (error) {
    return toActionError(error);
  }
}
