'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { APPROVAL_STATUS_LABEL, type ApprovalStatus } from '@dms/contracts/approvals';
import type { ActionResult } from '@dms/contracts/common';
import { upsertSalesTargetInput } from '@dms/contracts/sales-targets';
import { z } from 'zod';
import { toActionError, validationError } from '@/server/auth/action-error';
import { requireUser } from '@/server/auth/current-user';
import { resolveSubmitter } from '@/server/auth/on-behalf';
import { getClientIp, writeAuditMany } from '@/server/services/audit';
import { submitSalesTarget } from '@/server/services/sales-targets';

/** forUserId có khi Quản trị hệ thống đăng ký hoặc sửa thay chỉ tiêu của nhân viên. */
export async function submitSalesTargetAction(
  raw: unknown,
  rawForUserId: unknown = null,
): Promise<ActionResult<{ code: string; status: ApprovalStatus; selfApproved: boolean }>> {
  try {
    const user = await requireUser();
    const forUserId = z.uuid().nullable().safeParse(rawForUserId);
    if (!forUserId.success) return validationError(forUserId.error);
    const owner = await resolveSubmitter(user, forUserId.data, 'sales.target.register');
    const parsed = upsertSalesTargetInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);

    const [outcome, ip] = await Promise.all([
      submitSalesTarget(owner.id, parsed.data, new Date(), user.id),
      getClientIp(),
    ]);
    after(() =>
      writeAuditMany([
        {
          actor: user,
          action: outcome.created ? 'sales-target.create' : 'sales-target.update',
          entityType: 'SalesTarget',
          entityId: outcome.targetId,
          entityLabel: `${owner.employeeCode} ${outcome.month}`,
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
