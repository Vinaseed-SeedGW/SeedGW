import { NextResponse } from 'next/server';
import { z } from 'zod';
import { APPROVAL_PAGE_SIZE } from '@seedgw/contracts/approvals';
import { assertMobileCan, mobileRoute, requireMobileUser } from '@/server/auth/mobile';
import { listApprovals } from '@/server/services/approvals';
import { mobileApprovalViewer } from '@/server/services/mobile-approvals';

const query = z.object({
  tab: z.enum(['cho-toi-duyet', 'da-xu-ly']).catch('cho-toi-duyet'),
  trang: z.coerce.number().int().positive().max(1_000_000).catch(1),
});

// Mục Cần duyệt ở tab Tôi của Quản lý và Lãnh đạo đơn vị (A10b).
export const GET = mobileRoute(async (request: Request) => {
  const user = await requireMobileUser(request);
  assertMobileCan(user, 'sales.approval.review', 'Tài khoản chưa được cấp quyền duyệt phiếu');
  const url = new URL(request.url);
  const params = query.parse({
    tab: url.searchParams.get('tab') ?? undefined,
    trang: url.searchParams.get('trang') ?? undefined,
  });
  return NextResponse.json(
    await listApprovals(await mobileApprovalViewer(user), {
      tab: params.tab,
      lateOnly: false,
      page: params.trang,
      pageSize: APPROVAL_PAGE_SIZE,
    }),
  );
});
