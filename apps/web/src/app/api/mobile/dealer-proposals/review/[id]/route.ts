import { after, NextResponse } from 'next/server';
import { z } from 'zod';
import { mobileProposalDecision } from '@seedgw/contracts/dealer-proposals';
import { assertMobileCan, mobileError, mobileRoute, requireMobileUser } from '@/server/auth/mobile';
import { clientIp, readJson } from '@/server/auth/mobile-request';
import { writeAudit } from '@/server/services/audit';
import {
  approveProposalAsProposed,
  listMobileProposalReview,
  rejectProposal,
} from '@/server/services/dealer-proposals';

type Context = { params: Promise<{ id: string }> };

// Duyệt nhanh giữ nguyên thông tin như đề xuất, hoặc từ chối kèm lý do. App không duyệt thay.
export const POST = mobileRoute(async (request: Request, { params }: Context) => {
  const user = await requireMobileUser(request);
  assertMobileCan(user, 'sales.approval.review', 'Tài khoản chưa được cấp quyền duyệt');
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return mobileError('VALIDATION', 'Mã đề xuất không hợp lệ');
  const input = await readJson(request, mobileProposalDecision);
  const outcome =
    input.decision === 'APPROVE'
      ? await approveProposalAsProposed(user, id.data)
      : await rejectProposal(user, { id: id.data, note: input.note }, false);
  const ip = clientIp(request);
  after(() =>
    writeAudit({
      actor: { id: user.id, impersonator: null },
      action: input.decision === 'APPROVE' ? 'dealer.proposal.approve' : 'dealer.proposal.reject',
      entityType: outcome.dealerId ? 'Dealer' : 'DealerProposal',
      entityId: outcome.dealerId ?? outcome.proposalId,
      entityLabel: outcome.dealerName,
      changes: outcome.changes,
      ip,
    }),
  );
  return NextResponse.json(await listMobileProposalReview(user.id));
});
