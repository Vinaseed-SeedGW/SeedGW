import { after, NextResponse } from 'next/server';
import { APPROVAL_STATUS_LABEL } from '@seedgw/contracts/approvals';
import { upsertSalesTargetInput } from '@seedgw/contracts/sales-targets';
import { assertMobileCan, mobileRoute, requireMobileUser } from '@/server/auth/mobile';
import { clientIp, readJson } from '@/server/auth/mobile-request';
import { writeAuditMany } from '@/server/services/audit';
import { readMyTargets, submitSalesTarget } from '@/server/services/sales-targets';

const NO_TARGET_PERMISSION = 'Tài khoản chưa được cấp quyền xem chỉ tiêu';

// Chỉ tiêu tháng của chính mình kèm % hoàn thành (K3a).
export const GET = mobileRoute(async (request: Request) => {
  const user = await requireMobileUser(request);
  assertMobileCan(user, 'sales.target.read', NO_TARGET_PERMISSION);
  return NextResponse.json(
    await readMyTargets(user.id, user.permissions.has('sales.target.register')),
  );
});

export const POST = mobileRoute(async (request: Request) => {
  const user = await requireMobileUser(request);
  assertMobileCan(user, 'sales.target.register', 'Tài khoản chưa được cấp quyền đăng ký chỉ tiêu');
  const input = await readJson(request, upsertSalesTargetInput);
  const outcome = await submitSalesTarget(user.id, input);
  const ip = clientIp(request);
  const actor = { id: user.id, impersonator: null };
  after(() =>
    writeAuditMany([
      {
        actor,
        action: outcome.created ? 'sales-target.create' : 'sales-target.update',
        entityType: 'SalesTarget',
        entityId: outcome.targetId,
        entityLabel: `${user.employeeCode} ${outcome.month}`,
        changes: outcome.changes,
        ip,
      },
      {
        actor,
        action: 'approval.submit',
        entityType: 'ApprovalRequest',
        entityId: outcome.requestId,
        entityLabel: outcome.code,
        changes: { status: { before: null, after: APPROVAL_STATUS_LABEL[outcome.status] } },
        ip,
      },
    ]),
  );
  return NextResponse.json({
    ...(await readMyTargets(user.id, true)),
    submitted: { code: outcome.code, status: outcome.status, selfApproved: outcome.selfApproved },
  });
});
