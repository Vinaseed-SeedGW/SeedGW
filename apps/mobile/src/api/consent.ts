import {
  LOCATION_CONSENT_VERSION,
  type ConsentRecordView,
  type MobileConsentStatus,
} from '@seedgw/contracts/consents';
import {
  clearConsent,
  getConsentAt,
  getPendingConsentAction,
  saveConsent,
  setPendingConsentAction,
  type ConsentAction,
} from '../sync/track-db';
import { apiCall } from './client';
import { serverEnabled } from './session';

export type ConsentState = 'accepted' | 'needed';

/**
 * Đã đồng ý trên máy thì dùng ngay, kể cả lúc mất mạng. Chưa có trên máy thì hỏi máy chủ, vì người dùng
 * có thể đã đồng ý trên web hoặc trên máy khác.
 */
export async function loadConsentState(): Promise<ConsentState> {
  if (getConsentAt() !== null) return 'accepted';
  if (!serverEnabled() || getPendingConsentAction() === 'WITHDRAW') return 'needed';
  const result = await apiCall<MobileConsentStatus>('/api/mobile/consent', { method: 'GET' });
  if (result.ok && result.data.accepted && result.data.version === LOCATION_CONSENT_VERSION) {
    saveConsent(Date.parse(result.data.acceptedAt ?? '') || Date.now());
    return 'accepted';
  }
  return 'needed';
}

async function send(action: ConsentAction): Promise<boolean> {
  const result = await apiCall<MobileConsentStatus>('/api/mobile/consent', {
    method: 'POST',
    json: { version: LOCATION_CONSENT_VERSION, action },
  });
  // Máy chủ từ chối hẳn (bản câu chữ cũ) thì bỏ, không gửi lại mãi.
  return result.ok || !result.retryable;
}

/** Lưu trên máy trước rồi gửi; mất mạng thì hàng đợi gửi lại ở lần đồng bộ sau. */
export async function recordConsent(action: ConsentAction): Promise<void> {
  if (action === 'ACCEPT') saveConsent(Date.now());
  else clearConsent();
  if (!serverEnabled()) return;
  setPendingConsentAction(action);
  if (await send(action)) setPendingConsentAction(null);
}

/** Gọi trong mỗi lần đồng bộ. Trả lỗi để hiện ở dòng "Lần gửi gần nhất". */
export async function syncPendingConsent(): Promise<string | null> {
  const pending = getPendingConsentAction();
  if (!pending) return null;
  if (await send(pending)) {
    setPendingConsentAction(null);
    return null;
  }
  return 'Chưa gửi được lời đồng ý chia sẻ vị trí';
}

/** Sổ đồng ý của chính người dùng (25/11/2026), để xem và chia sẻ giấy xác nhận. */
export async function loadConsentRecords(): Promise<
  { ok: true; items: ConsentRecordView[] } | { ok: false; message: string }
> {
  const result = await apiCall<{ items: ConsentRecordView[] }>('/api/mobile/consent/records', {
    method: 'GET',
  });
  return result.ok
    ? { ok: true, items: result.data.items }
    : { ok: false, message: result.message };
}
