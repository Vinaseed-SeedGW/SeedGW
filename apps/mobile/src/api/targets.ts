import type {
  ApprovalDetail,
  ApprovalTab,
  ListApprovalsResult,
  MobileApprovalDecisionInput,
} from '@dms/contracts/approvals';
import type {
  MyTargetsResult,
  SalesTargetApprovalView,
  UpsertSalesTargetInput,
} from '@dms/contracts/sales-targets';
import { apiCall, type ApiResult } from './client';

export type Loaded<T> = { ok: true; data: T } | { ok: false; message: string };

function toLoaded<T>(result: ApiResult<T>): Loaded<T> {
  return result.ok ? { ok: true, data: result.data } : { ok: false, message: result.message };
}

/** Quyền và số phiếu chờ của tài khoản, đọc lại mỗi lần mở tab (K3a, A10b). */
export type Capabilities = {
  canRegisterTarget: boolean;
  canReviewApprovals: boolean;
  pendingApprovalCount: number;
};

export async function loadCapabilities(): Promise<Capabilities | null> {
  const result = await apiCall<Partial<Capabilities>>('/api/mobile/me', { method: 'GET' });
  if (!result.ok) return null;
  return {
    canRegisterTarget: result.data.canRegisterTarget === true,
    canReviewApprovals: result.data.canReviewApprovals === true,
    pendingApprovalCount: result.data.pendingApprovalCount ?? 0,
  };
}

// ---------- Chỉ tiêu của tôi ----------

export async function loadMyTargets(): Promise<Loaded<MyTargetsResult>> {
  return toLoaded(await apiCall<MyTargetsResult>('/api/mobile/targets', { method: 'GET' }));
}

export async function submitMyTarget(
  input: UpsertSalesTargetInput,
): Promise<Loaded<MyTargetsResult>> {
  return toLoaded(
    await apiCall<MyTargetsResult>('/api/mobile/targets', { method: 'POST', json: input }),
  );
}

export async function withdrawMyApproval(code: string): Promise<Loaded<MyTargetsResult>> {
  return toLoaded(
    await apiCall<MyTargetsResult>(`/api/mobile/approvals/${encodeURIComponent(code)}/withdraw`, {
      method: 'POST',
      json: {},
    }),
  );
}

// ---------- Cần duyệt ----------

export type MobileApprovalTab = Extract<ApprovalTab, 'cho-toi-duyet' | 'da-xu-ly'>;
export type ApprovalPage = { approval: ApprovalDetail; target: SalesTargetApprovalView | null };

export async function listMyApprovals(
  tab: MobileApprovalTab,
): Promise<Loaded<ListApprovalsResult>> {
  return toLoaded(
    await apiCall<ListApprovalsResult>(`/api/mobile/approvals?tab=${tab}`, { method: 'GET' }),
  );
}

export async function readApprovalPage(code: string): Promise<Loaded<ApprovalPage>> {
  return toLoaded(
    await apiCall<ApprovalPage>(`/api/mobile/approvals/${encodeURIComponent(code)}`, {
      method: 'GET',
    }),
  );
}

export async function decideApproval(
  code: string,
  input: MobileApprovalDecisionInput,
): Promise<Loaded<ApprovalPage>> {
  return toLoaded(
    await apiCall<ApprovalPage>(`/api/mobile/approvals/${encodeURIComponent(code)}`, {
      method: 'POST',
      json: input,
    }),
  );
}
