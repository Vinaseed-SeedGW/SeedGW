'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { APPROVAL_STATUS_LABEL, type ApprovalStatus } from '@dms/contracts/approvals';
import type { ActionResult } from '@dms/contracts/common';
import { upsertSalesTargetInput } from '@dms/contracts/sales-targets';
import { toActionError, validationError } from '@/server/auth/action-error';
import { assertCan } from '@/server/auth/can';
import { requireUser } from '@/server/auth/current-user';
import { getClientIp, writeAuditMany } from '@/server/services/audit';
import { submitSalesTarget } from '@/server/services/sales-targets';

export async function submitSalesTargetAction(
  raw: unknown,
): Promise<ActionResult<{ code: string; status: ApprovalStatus; selfApproved: boolean }>> {
  try {
    const user = await requireUser();
    assertCan(user, 'sales.target.register');
    const parsed = upsertSalesTargetInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);

    const [outcome, ip] = await Promise.all([
      submitSalesTarget(user.id, parsed.data),
      getClientIp(),
    ]);
    after(() =>
      writeAuditMany([
        {
          actor: user,
          action: outcome.created ? 'sales-target.create' : 'sales-target.update',
          entityType: 'SalesTarget',
          entityId: outcome.targetId,
          entityLabel: `${user.employeeCode} ${outcome.month}`,
          changes: outcome.changes,
          ip,
        },
        {
          actor: user,
          action: 'approval.submit',
          entityType: 'ApprovalRequest',
          entityId: outcome.requestId,
          entityLabel: outcome.code,
          changes: { status: { before: null, after: APPROVAL_STATUS_LABEL[outcome.status] } },
          ip,
        },
      ]),
    );
    revalidatePath('/kinh-doanh/chi-tieu');
    revalidatePath('/kinh-doanh/can-duyet', 'layout');
    return {
      ok: true,
      data: { code: outcome.code, status: outcome.status, selfApproved: outcome.selfApproved },
    };
  } catch (error) {
    return toActionError(error);
  }
}
