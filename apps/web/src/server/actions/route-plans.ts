'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { z } from 'zod';
import { APPROVAL_STATUS_LABEL } from '@dms/contracts/approvals';
import type { ActionResult } from '@dms/contracts/common';
import {
  routeDealerSearchInput,
  submitRoutePlanInput,
  type RouteDealerOption,
} from '@dms/contracts/route-plans';
import { toActionError, validationError } from '@/server/auth/action-error';
import { assertCan, can } from '@/server/auth/can';
import { requireUser } from '@/server/auth/current-user';
import { resolveSubmitter } from '@/server/auth/on-behalf';
import { getScopedDb } from '@/server/auth/scoped-db';
import { getClientIp, writeAuditMany } from '@/server/services/audit';
import { searchRouteDealers, submitRoutePlan } from '@/server/services/route-plans';

/** Đăng ký hoặc sửa tuyến trên web; forUserId có khi Quản trị hệ thống gửi thay nhân viên. */
export async function submitRoutePlanAction(
  raw: unknown,
  rawForUserId: unknown = null,
): Promise<ActionResult<{ code: string; isLate: boolean; selfApproved: boolean }>> {
  try {
    const user = await requireUser();
    const forUserId = z.uuid().nullable().safeParse(rawForUserId);
    if (!forUserId.success) return validationError(forUserId.error);
    const owner = await resolveSubmitter(user, forUserId.data, 'sales.route.register');
    const parsed = submitRoutePlanInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);

    const [scoped, ip] = await Promise.all([getScopedDb(), getClientIp()]);
    const outcome = await submitRoutePlan(owner.id, scoped, parsed.data, new Date(), user.id);
    after(() =>
      writeAuditMany([
        {
          actor: user,
          action: outcome.created ? 'route-plan.create' : 'route-plan.update',
          entityType: 'RoutePlan',
          entityId: outcome.planId,
          entityLabel: `${owner.employeeCode} ${outcome.periodLabel}`,
          changes: outcome.changes,
          ip,
        },
        {
          actor: user,
          action: 'approval.submit',
          entityType: 'ApprovalRequest',
          entityId: outcome.requestId,
          entityLabel: outcome.code,
          changes: {
            status: { before: null, after: APPROVAL_STATUS_LABEL[outcome.status] },
            ...(outcome.isLate ? { 'Nộp muộn': { before: null, after: 'Có' } } : {}),
          },
          ip,
        },
      ]),
    );
    revalidatePath('/kinh-doanh/tuyen-vieng-tham', 'layout');
    revalidatePath('/kinh-doanh/can-duyet', 'layout');
    return {
      ok: true,
      data: { code: outcome.code, isLate: outcome.isLate, selfApproved: outcome.selfApproved },
      warnings: outcome.isLate
        ? [{ code: 'LATE', message: 'Đã qua hạn nộp, phiếu gắn nhãn Nộp muộn' }]
        : undefined,
    };
  } catch (error) {
    return toActionError(error);
  }
}

/** Tìm đại lý để thêm vào tuyến, trong phạm vi dữ liệu của người đang bấm, tối đa 20 kết quả. */
export async function searchRouteDealersAction(
  raw: unknown,
): Promise<ActionResult<RouteDealerOption[]>> {
  try {
    const user = await requireUser();
    if (!can(user, 'sales.route.register')) assertCan(user, 'sales.approval.override');
    const parsed = routeDealerSearchInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);
    return { ok: true, data: await searchRouteDealers(await getScopedDb(), parsed.data.q) };
  } catch (error) {
    return toActionError(error);
  }
}
