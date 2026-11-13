import { MAX_TRACK_POINTS_PER_BATCH, type CheckInReceipt } from '@dms/contracts/check-ins';
import { apiCall, type ApiFailure } from '../api/client';
import { loadSession, serverEnabled } from '../api/session';
import {
  listQueuedCheckIns,
  listUnsyncedPoints,
  listUnsyncedSessions,
  markPointsSynced,
  markSessionSynced,
  setCheckInSyncStatus,
  type QueuedCheckIn,
} from './track-db';
import { base64ToBytes } from './xlsx';

// Gửi dữ liệu trên máy lên máy chủ. Mọi thứ đã lưu SQLite trước, nên mất mạng chỉ làm chậm, không mất (M3).
const MAX_POINT_BATCHES_PER_RUN = 20;
const CHECK_INS_PER_RUN = 20;

export type SyncReport = {
  ran: boolean;
  sentCheckIns: number;
  sentPoints: number;
  error: string | null;
};

let running: Promise<SyncReport> | null = null;
let lastRunAt = 0;

/** Lỗi do dữ liệu sai thì đánh dấu hỏng để không gửi lặp mãi. Lỗi mạng thì dừng, chờ lần sau. */
function isPermanent(failure: ApiFailure): boolean {
  return (
    !failure.retryable && failure.status >= 400 && failure.status < 500 && failure.status !== 401
  );
}

async function syncSessions(): Promise<string | null> {
  for (const session of listUnsyncedSessions()) {
    const result = await apiCall('/api/mobile/track-sessions', {
      method: 'PUT',
      json: {
        clientId: session.client_id,
        startedAt: new Date(session.started_at).toISOString(),
        endedAt: session.ended_at === null ? null : new Date(session.ended_at).toISOString(),
        endReason: session.end_reason,
      },
    });
    if (!result.ok) return result.message;
    markSessionSynced(session.id, session.ended_at);
  }
  return null;
}

async function syncPoints(): Promise<{ sent: number; error: string | null }> {
  let sent = 0;
  for (let batch = 0; batch < MAX_POINT_BATCHES_PER_RUN; batch += 1) {
    const points = listUnsyncedPoints(MAX_TRACK_POINTS_PER_BATCH);
    const first = points[0];
    const last = points.at(-1);
    if (!first || !last) break;
    const result = await apiCall<{ accepted: number }>('/api/mobile/track-points', {
      method: 'POST',
      json: {
        points: points.map((p) => ({
          recordedAt: new Date(p.recordedAt).toISOString(),
          lat: p.lat,
          lng: p.lng,
          accuracyM: p.accuracy,
          speedMps: p.speed !== null && p.speed >= 0 ? p.speed : null,
          isMocked: p.mocked,
          isBackground: p.appState !== 'active',
        })),
      },
    });
    if (!result.ok) return { sent, error: result.message };
    markPointsSynced(first.recordedAt, last.recordedAt);
    sent += points.length;
  }
  return { sent, error: null };
}

async function sendCheckIn(item: QueuedCheckIn): Promise<string | null> {
  if (item.status === 'pending') {
    const result = await apiCall<CheckInReceipt>('/api/mobile/check-ins', {
      method: 'POST',
      json: {
        clientId: item.clientId,
        capturedAt: new Date(item.takenAt).toISOString(),
        lat: item.lat,
        lng: item.lng,
        accuracyM: item.accuracy,
        isMocked: item.mocked,
        placeKind: item.placeKind ?? 'OTHER',
        placeName: item.placeName ?? '',
        note: item.note ?? '',
        addressOnPhoto: item.address,
      },
    });
    if (!result.ok) {
      if (isPermanent(result)) setCheckInSyncStatus(item.id, 'failed', result.message);
      return result.message;
    }
    setCheckInSyncStatus(item.id, result.data.hasPhoto ? 'synced' : 'row_synced', null);
    if (result.data.hasPhoto) return null;
  }

  const comma = item.dataUri.indexOf(',');
  const bytes = base64ToBytes(item.dataUri.slice(comma + 1));
  const upload = await apiCall(`/api/mobile/check-ins/${item.clientId}/photo`, {
    method: 'PUT',
    body: bytes.buffer as ArrayBuffer,
    contentType: 'image/jpeg',
  });
  if (!upload.ok) {
    // Máy chủ chưa có dòng check-in (ví dụ dữ liệu máy chủ bị xoá): gửi lại dòng ở lần sau.
    if (upload.status === 404) setCheckInSyncStatus(item.id, 'pending', null);
    else if (isPermanent(upload)) setCheckInSyncStatus(item.id, 'failed', upload.message);
    return upload.message;
  }
  setCheckInSyncStatus(item.id, 'synced', null);
  return null;
}

async function runSync(): Promise<SyncReport> {
  const report: SyncReport = { ran: true, sentCheckIns: 0, sentPoints: 0, error: null };
  // Phiên ghi gửi trước để máy chủ biết không cộng km nối giữa hai phiên.
  report.error = await syncSessions();
  if (report.error) return report;

  // Check-in gửi trước điểm GPS để quản lý thấy lượt ghé thăm sớm nhất có thể.
  for (const item of listQueuedCheckIns(CHECK_INS_PER_RUN)) {
    const error = await sendCheckIn(item);
    if (error) {
      report.error = error;
      return report;
    }
    report.sentCheckIns += 1;
  }

  const points = await syncPoints();
  report.sentPoints = points.sent;
  report.error = points.error;
  return report;
}

/**
 * Gửi những gì đang chờ. Gọi lúc mở app, sau khi lưu check-in, mỗi phút khi app mở và từ tác vụ nền.
 * `minIntervalMs` để tác vụ nền không gọi mạng quá dày.
 */
export async function syncNow(minIntervalMs = 0): Promise<SyncReport> {
  const skipped: SyncReport = { ran: false, sentCheckIns: 0, sentPoints: 0, error: null };
  if (!serverEnabled() || !(await loadSession())) return skipped;
  if (running) return running;
  if (Date.now() - lastRunAt < minIntervalMs) return skipped;
  lastRunAt = Date.now();
  running = runSync().finally(() => {
    running = null;
  });
  return running;
}
