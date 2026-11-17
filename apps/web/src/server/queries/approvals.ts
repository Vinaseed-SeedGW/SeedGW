import 'server-only';
import { cache } from 'react';
import type {
  ApprovalDetail,
  ListApprovalsInput,
  ListApprovalsResult,
} from '@dms/contracts/approvals';
import type { RouteApprovalView } from '@dms/contracts/route-plans';
import type { SalesTargetApprovalView } from '@dms/contracts/sales-targets';
import { assertCan, can } from '@/server/auth/can';
import { requireUser, type CurrentUser } from '@/server/auth/current-user';
import { getScopedDb } from '@/server/auth/scoped-db';
import {
  countPendingForApprover,
  listApprovals,
  readApproval,
  type ApprovalViewer,
} from '@/server/services/approvals';
import { DomainError } from '@/server/services/domain-error';
import { readRouteApprovalView } from '@/server/services/route-plans';
import { readTargetApprovalView } from '@/server/services/sales-targets';

async function viewerOf(user: CurrentUser): Promise<ApprovalViewer> {
  return {
    id: user.id,
    canRead: can(user, 'sales.approval.read'),
    canReview: can(user, 'sales.approval.review'),
    canOverride: can(user, 'sales.approval.override'),
    scoped: await getScopedDb(),
  };
}

export async function listApprovalRequests(
  input: ListApprovalsInput,
): Promise<ListApprovalsResult> {
  const user = await requireUser();
  assertCan(user, 'sales.approval.read');
  return listApprovals(await viewerOf(user), input);
}

export type ApprovalPageData = {
  approval: ApprovalDetail;
  target: SalesTargetApprovalView | null;
  route: RouteApprovalView | null;
};

/** null khi không có phiếu hoặc người xem không được xem phiếu này. */
export async function getApprovalRequest(code: string): Promise<ApprovalPageData | null> {
  const user = await requireUser();
  assertCan(user, 'sales.approval.read');
  let approval: ApprovalDetail;
  try {
    approval = await readApproval(await viewerOf(user), code);
  } catch (error) {
    if (error instanceof DomainError && error.code === 'NOT_FOUND') return null;
    throw error;
  }
  const [target, route] = await Promise.all([
    approval.kind === 'SALES_TARGET' ? readTargetApprovalView(approval.subjectId) : null,
    approval.kind === 'ROUTE_PLAN' ? readRouteApprovalView(approval.subjectId) : null,
  ]);
  return { approval, target, route };
}

/** Số phiếu chờ mình duyệt, hiện cạnh mục Cần duyệt trên menu. */
export const getPendingApprovalCount = cache(async (): Promise<number> => {
  const user = await requireUser();
  if (!can(user, 'sales.approval.review')) return 0;
  return countPendingForApprover(user.id);
});
