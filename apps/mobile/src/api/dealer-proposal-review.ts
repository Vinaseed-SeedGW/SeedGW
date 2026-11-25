import type {
  MobileProposalDecision,
  MobileProposalReviewList,
} from '@seedgw/contracts/dealer-proposals';
import { apiCall } from './client';
import type { Loaded } from './targets';

// 25/11/2026: Quản lý, Lãnh đạo đơn vị duyệt nhanh đề xuất đại lý mới ở Cần duyệt.

export async function listProposalReview(): Promise<Loaded<MobileProposalReviewList>> {
  const result = await apiCall<MobileProposalReviewList>('/api/mobile/dealer-proposals/review', {
    method: 'GET',
  });
  return result.ok ? { ok: true, data: result.data } : { ok: false, message: result.message };
}

export async function decideProposal(
  id: string,
  input: MobileProposalDecision,
): Promise<Loaded<MobileProposalReviewList>> {
  const result = await apiCall<MobileProposalReviewList>(
    `/api/mobile/dealer-proposals/review/${encodeURIComponent(id)}`,
    { method: 'POST', json: input },
  );
  return result.ok ? { ok: true, data: result.data } : { ok: false, message: result.message };
}
