import {
  CHECK_IN_RETENTION_MONTHS,
  type CheckInFlag,
  type CheckInPlaceKind,
  type MobileHistoryResult,
} from '@dms/contracts/check-ins';
import { apiCall } from '../api/client';
import { loadSession, serverEnabled } from '../api/session';
import { legMetersOf } from './day-report-sheets';
import { startOfVnDay } from './geo';
import { readDayTrack, readLocalHistory, type LocalHistoryRow } from './track-db';

// Tab Lịch sử (M6): có mạng thì ưu tiên dữ liệu máy chủ (đầy đủ 18 tháng, km máy chủ tính), mất mạng thì
// dùng dữ liệu trên máy. App luôn ghi trên máy trước rồi mới gửi, nên lượt chưa gửi vẫn hiện, gắn Chờ gửi.

const VN_OFFSET_MS = 7 * 3_600_000;

export type HistoryStatus = 'SERVER' | 'PENDING' | 'FAILED' | 'DEVICE_ONLY';

export type HistoryEntry = {
  key: string;
  clientId: string | null;
  localPhotoId: number | null;
  capturedAt: number;
  placeKind: CheckInPlaceKind;
  placeName: string;
  note: string;
  farReason: string | null;
  address: string | null;
  legKm: number | null;
  // V1b: km theo đường đi khi máy chủ đã tính, không thì km theo GPS.
  legSource: 'ROAD' | 'GPS';
  estimated: boolean;
  flags: CheckInFlag[];
  status: HistoryStatus;
  remotePhoto: boolean;
};

export type HistoryMonth = {
  month: string;
  earliestMonth: string;
  source: 'SERVER' | 'DEVICE';
  entries: HistoryEntry[];
  notice: string | null;
};

/** Tháng hiện tại theo giờ Việt Nam, dạng yyyy-MM. */
export function currentMonth(now = Date.now()): string {
  return new Date(now + VN_OFFSET_MS).toISOString().slice(0, 7);
}

export function shiftMonth(month: string, delta: number): string {
  const [year, value] = month.split('-').map(Number);
  return new Date(Date.UTC(year ?? 1970, (value ?? 1) - 1 + delta, 1)).toISOString().slice(0, 7);
}

function monthStart(month: string): number {
  const [year, value] = month.split('-').map(Number);
  return Date.UTC(year ?? 1970, (value ?? 1) - 1, 1) - VN_OFFSET_MS;
}

/** Km từng lượt tính trên máy bằng đúng cách lọc GPS của máy chủ (khi chưa có số của máy chủ). */
function localLegs(rows: readonly LocalHistoryRow[]): Map<number, number> {
  const byDay = new Map<number, LocalHistoryRow[]>();
  for (const row of rows) {
    const day = startOfVnDay(row.takenAt);
    byDay.set(day, [...(byDay.get(day) ?? []), row]);
  }
  const legs = new Map<number, number>();
  for (const [day, photos] of byDay) {
    for (const [id, meters] of legMetersOf(photos, readDayTrack(day).track)) legs.set(id, meters);
  }
  return legs;
}

function fromLocal(row: LocalHistoryRow, legMeters: number | undefined): HistoryEntry {
  return {
    key: `local-${row.id}`,
    clientId: row.clientId,
    localPhotoId: row.id,
    capturedAt: row.takenAt,
    placeKind: row.placeKind ?? 'OTHER',
    placeName: row.placeName ?? '',
    note: row.note ?? '',
    farReason: row.farReason,
    address: row.address,
    legKm: legMeters === undefined ? null : Math.round(legMeters) / 1000,
    legSource: 'GPS',
    estimated: false,
    flags: [],
    status:
      row.status === 'failed'
        ? 'FAILED'
        : row.status === 'pending' || row.status === 'row_synced'
          ? 'PENDING'
          : 'DEVICE_ONLY',
    remotePhoto: false,
  };
}

export async function loadHistoryMonth(month: string, now = Date.now()): Promise<HistoryMonth> {
  const from = monthStart(month);
  const to = monthStart(shiftMonth(month, 1));
  const localRows = readLocalHistory(from, to);
  const legs = localLegs(localRows);
  const offlineEarliest = shiftMonth(currentMonth(now), -CHECK_IN_RETENTION_MONTHS);

  const deviceOnly = (notice: string | null): HistoryMonth => ({
    month,
    earliestMonth: offlineEarliest,
    source: 'DEVICE',
    entries: localRows.map((row) => fromLocal(row, legs.get(row.id))),
    notice,
  });

  if (!serverEnabled() || !(await loadSession())) return deviceOnly(null);
  const result = await apiCall<MobileHistoryResult>(`/api/mobile/check-ins?month=${month}`, {
    method: 'GET',
  });
  if (!result.ok) {
    return deviceOnly(
      'Chưa kết nối được máy chủ, đang xem dữ liệu lưu trên máy này. Có mạng sẽ hiện đủ lịch sử.',
    );
  }

  const localByClient = new Map(
    localRows.flatMap((row) => (row.clientId ? [[row.clientId, row] as const] : [])),
  );
  const serverIds = new Set(result.data.items.map((item) => item.clientId));
  const entries: HistoryEntry[] = result.data.items.map((item) => ({
    key: item.clientId,
    clientId: item.clientId,
    localPhotoId: localByClient.get(item.clientId)?.id ?? null,
    capturedAt: Date.parse(item.capturedAt),
    placeKind: item.placeKind,
    placeName: item.placeName,
    note: item.note,
    farReason: item.farReason,
    address: item.address,
    ...(item.roadDistanceKm === null || item.roadDistanceKm === undefined
      ? {
          legKm: item.gpsDistanceKm,
          legSource: 'GPS' as const,
          estimated: item.isDistanceEstimated,
        }
      : {
          legKm: item.roadDistanceKm,
          legSource: 'ROAD' as const,
          estimated: item.isRoadEstimated ?? false,
        }),
    flags: item.flags,
    status: 'SERVER',
    remotePhoto: item.hasPhoto,
  }));
  // Lượt còn trên máy mà máy chủ chưa có (chưa gửi xong, hoặc dữ liệu thử trước khi nối máy chủ).
  for (const row of localRows) {
    if (row.clientId && serverIds.has(row.clientId)) continue;
    entries.push(fromLocal(row, legs.get(row.id)));
  }
  entries.sort((a, b) => a.capturedAt - b.capturedAt);
  return {
    month,
    earliestMonth: result.data.earliestMonth,
    source: 'SERVER',
    entries,
    notice: null,
  };
}
