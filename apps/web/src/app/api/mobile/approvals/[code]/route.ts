import { after, NextResponse } from 'next/server';
import { z } from 'zod';
import { mobileApprovalDecisionInput } from '@seedgw/contracts/approvals';
import { assertMobileCan, mobileError, mobileRoute, requireMobileUser } from '@/server/auth/mobile';
import { clientIp, readJson } from '@/server/auth/mobile-request';
import { approveRequest, readApproval, returnRequest } from '@/server/services/approvals';
import { auditMobileApproval, mobileApprovalViewer } from '@/server/services/mobile-approvals';
import { readRouteApprovalView } from '@/server/services/route-plans';
import { readTargetApprovalView } from '@/server/services/sales-targets';

type Context = { params: Promise<{ code: string }> };

const approvalCode = z.string().trim().min(1).max(40);

async function detail(code: string, viewer: Awaited<ReturnType<typeof mobileApprovalViewer>>) {
  const approval = await readApproval(viewer, code);
  const [target, route] = await Promise.all([
    approval.kind === 'SALES_TARGET' ? readTargetApprovalView(approval.subjectId) : null,
    approval.kind === 'ROUTE_PLAN' ? readRouteApprovalView(approval.subjectId) : null,
  ]);
  return { approval, target, route };
}

export const GET = mobileRoute(async (request: Request, { params }: Context) => {
  const user = await requireMobileUser(request);
  const code = approvalCode.safeParse((await params).code);
  if (!code.success) return mobileError('VALIDATION', 'Mã phiếu không hợp lệ');
  return NextResponse.json(await detail(code.data, await mobileApprovalViewer(user)));
});

// Duyệt hoặc trả lại phiếu đang chờ mình.
export const POST = mobileRoute(async (request: Request, { params }: Context) => {
  const user = await requireMobileUser(request);
  assertMobileCan(user, 'sales.approval.review', 'Tài khoản chưa được cấp quyền duyệt phiếu');
  const code = approvalCode.safeParse((await params).code);
  if (!code.success) return mobileError('VALIDATION', 'Mã phiếu không hợp lệ');
  const input = await readJson(request, mobileApprovalDecisionInput);
  const override = user.permissions.has('sales.approval.override');
  const outcome =
    input.decision === 'APPROVE'
      ? await approveRequest(user.id, code.data, input.note, new Date(), override)
      : await returnRequest(user.id, code.data, input.reason, new Date(), override);
  const ip = clientIp(request);
  after(() =>
    auditMobileApproval(
      user,
      input.decision === 'APPROVE' ? 'approval.approve' : 'approval.return',
      [outcome],
      ip,
    ),
  );
  return NextResponse.json(await detail(code.data, await mobileApprovalViewer(user)));
});
