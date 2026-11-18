import type { SupportDetail, SupportListResult } from '@dms/contracts/support';
import { apiCall, type ApiResult } from './client';

// Hỗ trợ trên app (T3). Tạo yêu cầu và trả lời đi qua hàng đợi ../sync/support-outbox.

export function listMySupport(page = 1): Promise<ApiResult<SupportListResult>> {
  return apiCall<SupportListResult>(`/api/mobile/support?trang=${page}`, { method: 'GET' });
}

export function readSupport(code: string): Promise<ApiResult<SupportDetail>> {
  return apiCall<SupportDetail>(`/api/mobile/support/${code}`, { method: 'GET' });
}

export function reopenSupport(code: string): Promise<ApiResult<{ code: string }>> {
  return apiCall<{ code: string }>(`/api/mobile/support/${code}/reopen`, {
    method: 'POST',
    json: {},
  });
}

/** Số yêu cầu có trả lời chưa đọc; lỗi mạng thì null để giữ số cũ. */
export async function readSupportBadge(): Promise<number | null> {
  const result = await apiCall<{ count: number }>('/api/mobile/support/badge', { method: 'GET' });
  return result.ok ? result.data.count : null;
}

export function supportFilePath(id: string): string {
  return `/api/mobile/support/files/${id}`;
}
