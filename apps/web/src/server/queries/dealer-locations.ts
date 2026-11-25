import 'server-only';
import type {
  ListDealerLocationProposalsInput,
  ListDealerLocationProposalsResult,
} from '@seedgw/contracts/dealer-locations';
import { assertCan, can } from '@/server/auth/can';
import { requireUser } from '@/server/auth/current-user';
import { getScopedDb } from '@/server/auth/scoped-db';
import { listProposals } from '@/server/services/dealer-locations';

// Quản trị đơn vị thấy đề xuất của đại lý thuộc đơn vị mình, Quản trị hệ thống thấy tất cả (M4).
export async function listDealerLocationProposals(
  input: ListDealerLocationProposalsInput,
): Promise<ListDealerLocationProposalsResult> {
  const user = await requireUser();
  assertCan(user, 'admin.dealer-location.approve');
  return listProposals(input);
}

/** D3: số toạ độ chờ duyệt cạnh mục Duyệt toạ độ và trên Hub; người không duyệt thì 0. */
export async function getLocationProposalPendingCount(): Promise<number> {
  const user = await requireUser();
  if (!can(user, 'admin.dealer-location.approve')) return 0;
  const scoped = await getScopedDb();
  return scoped.dealerLocationProposal.count({ where: { status: 'PENDING' } });
}
