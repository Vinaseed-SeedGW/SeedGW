import type { MyDealerProposalsResult } from '@seedgw/contracts/dealer-proposals';
import { apiCall } from './client';
import type { Loaded } from './targets';

/** Đề xuất đại lý mới của tôi (M10), chỉ đọc khi có mạng. */
export async function loadMyDealerProposals(): Promise<Loaded<MyDealerProposalsResult>> {
  const result = await apiCall<MyDealerProposalsResult>('/api/mobile/dealer-proposals', {
    method: 'GET',
  });
  return result.ok ? { ok: true, data: result.data } : { ok: false, message: result.message };
}
