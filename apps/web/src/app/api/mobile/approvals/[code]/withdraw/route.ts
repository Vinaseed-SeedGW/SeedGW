import { after, NextResponse } from 'next/server';
import { z } from 'zod';
import { mobileError, mobileRoute, requireMobileUser } from '@/server/auth/mobile';
import { clientIp } from '@/server/auth/mobile-request';
import { withdrawRequest } from '@/server/services/approvals';
import { auditMobileApproval } from '@/server/services/mobile-approvals';
import { readMyTargets } from '@/server/services/sales-targets';

type Context = { params: Promise<{ code: string }> };

// Người gửi rút lại phiếu của mình khi chưa ai duyệt; service kiểm đúng người gửi.
export const POST = mobileRoute(async (request: Request, { params }: Context) => {
  const user = await requireMobileUser(request);
  const code = z
    .string()
    .trim()
    .min(1)
    .max(40)
    .safeParse((await params).code);
  if (!code.success) return mobileError('VALIDATION', 'Mã phiếu không hợp lệ');
  const outcome = await withdrawRequest(user.id, code.data);
  const ip = clientIp(request);
  after(() => auditMobileApproval(user, 'approval.withdraw', [outcome], ip));
  return NextResponse.json(
    await readMyTargets(user.id, user.permissions.has('sales.target.register')),
  );
});
