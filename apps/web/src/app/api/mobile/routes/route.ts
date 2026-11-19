import { after, NextResponse } from 'next/server';
import { APPROVAL_STATUS_LABEL } from '@seedgw/contracts/approvals';
import { submitRoutePlanInput } from '@seedgw/contracts/route-plans';
import {
  assertMobileCan,
  mobileRoute,
  mobileScopedDb,
  requireMobileUser,
} from '@/server/auth/mobile';
import { clientIp, readJson } from '@/server/auth/mobile-request';
import { writeAuditMany } from '@/server/services/audit';
import { readMyRoutes, submitRoutePlan } from '@/server/services/route-plans';

// Tuyến của chính mình: kỳ đăng ký được, tuyến hôm nay đã duyệt, điểm đã ghé (S8).
export const GET = mobileRoute(async (request: Request) => {
  const user = await requireMobileUser(request);
  assertMobileCan(user, 'sales.route.read', 'Tài khoản chưa được cấp quyền xem tuyến');
  return NextResponse.json(
    await readMyRoutes(user.id, user.permissions.has('sales.route.register')),
  );
});

export const POST = mobileRoute(async (request: Request) => {
  const user = await requireMobileUser(request);
  assertMobileCan(user, 'sales.route.register', 'Tài khoản chưa được cấp quyền đăng ký tuyến');
  const input = await readJson(request, submitRoutePlanInput);
  const outcome = await submitRoutePlan(user.id, await mobileScopedDb(user), input);
  const ip = clientIp(request);
  const actor = { id: user.id, impersonator: null };
  after(() =>
    writeAuditMany([
      {
        actor,
        action: outcome.created ? 'route-plan.create' : 'route-plan.update',
        entityType: 'RoutePlan',
        entityId: outcome.planId,
        entityLabel: `${user.employeeCode} ${outcome.periodLabel}`,
        changes: outcome.changes,
        ip,
      },
      {
        actor,
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
  return NextResponse.json({
    ...(await readMyRoutes(user.id, true)),
    submitted: {
      code: outcome.code,
      status: outcome.status,
      selfApproved: outcome.selfApproved,
      isLate: outcome.isLate,
    },
  });
});
