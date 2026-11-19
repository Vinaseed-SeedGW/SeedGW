import 'server-only';
import type {
  ListDealerLocationProposalsInput,
  ListDealerLocationProposalsResult,
} from '@seedgw/contracts/dealer-locations';
import { assertCan } from '@/server/auth/can';
import { requireUser } from '@/server/auth/current-user';
import { listProposals } from '@/server/services/dealer-locations';

// Quản trị đơn vị thấy đề xuất của đại lý thuộc đơn vị mình, Quản trị hệ thống thấy tất cả (M4).
export async function listDealerLocationProposals(
  input: ListDealerLocationProposalsInput,
): Promise<ListDealerLocationProposalsResult> {
  const user = await requireUser();
  assertCan(user, 'admin.dealer-location.approve');
  return listProposals(input);
}
