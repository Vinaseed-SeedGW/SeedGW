import { distanceMeters } from './geo';

/** Ngưỡng lọc theo CHECK_IN_PLAN §3.4, để số km trên app gần với số máy chủ sẽ tính. */
export const FILTER = {
  maxAccuracyM: 50,
  maxSpeedKmh: 150,
  gapMinutes: 5,
  gapMeters: 300,
  stopRadiusM: 40,
  stopMinSeconds: 60,
} as const;

export type RawPoint = {
  recordedAt: number;
  lat: number;
  lng: number;
  accuracy: number | null;
  /** Số thứ tự phiên ghi chứa điểm. Không cộng km nối giữa hai phiên vì lúc đó app không ghi. */
  segment: number;
};

export type KeptPoint = {
  recordedAt: number;
  lat: number;
  lng: number;
  segment: number;
  /** Km cộng dồn từ đầu ngày tới điểm này, tính bằng mét. */
  cumulativeM: number;
};

export type FilteredTrack = {
  kept: KeptPoint[];
  distanceM: number;
  poorAccuracyCount: number;
  speedRejectedCount: number;
  stopCount: number;
  gapCount: number;
  longestGapMinutes: number;
};

type Base = Omit<KeptPoint, 'cumulativeM'>;

/**
 * Gộp chỗ dừng: khi đứng yên, iPhone báo vị trí nhảy qua lại vài chục mét và mỗi lần nhảy
 * sinh thêm km giả. Chuỗi điểm nằm trong bán kính 40 m quanh điểm đầu, kéo dài từ 1 phút,
 * được thay bằng một điểm ở giữa, giữ thời điểm của điểm đầu.
 */
function mergeStops(points: readonly Base[]): { merged: Base[]; stopCount: number } {
  const merged: Base[] = [];
  let stopCount = 0;
  let i = 0;
  while (i < points.length) {
    const first = points[i];
    if (!first) break;
    let j = i;
    while (j + 1 < points.length) {
      const next = points[j + 1];
      if (!next || next.segment !== first.segment) break;
      if (distanceMeters(first, next) > FILTER.stopRadiusM) break;
      j += 1;
    }
    const last = points[j];
    if (j > i && last && (last.recordedAt - first.recordedAt) / 1000 >= FILTER.stopMinSeconds) {
      const group = points.slice(i, j + 1);
      merged.push({
        recordedAt: first.recordedAt,
        lat: group.reduce((sum, p) => sum + p.lat, 0) / group.length,
        lng: group.reduce((sum, p) => sum + p.lng, 0) / group.length,
        segment: first.segment,
      });
      stopCount += 1;
      i = j + 1;
    } else {
      merged.push(first);
      i += 1;
    }
  }
  return { merged, stopCount };
}

/** Lọc vết GPS một ngày theo thứ tự: bỏ điểm sai số lớn, gộp chỗ dừng, bỏ điểm nhảy quá nhanh. */
export function filterTrack(points: readonly RawPoint[]): FilteredTrack {
  const accurate: Base[] = [];
  let poorAccuracyCount = 0;
  for (const point of points) {
    if (point.accuracy === null || point.accuracy > FILTER.maxAccuracyM) {
      poorAccuracyCount += 1;
      continue;
    }
    accurate.push({
      recordedAt: point.recordedAt,
      lat: point.lat,
      lng: point.lng,
      segment: point.segment,
    });
  }

  const { merged, stopCount } = mergeStops(accurate);

  const kept: KeptPoint[] = [];
  let distanceM = 0;
  let speedRejectedCount = 0;
  let gapCount = 0;
  let longestGapMinutes = 0;
  for (const point of merged) {
    const previous = kept.at(-1);
    if (previous && previous.segment === point.segment) {
      const meters = distanceMeters(previous, point);
      const seconds = (point.recordedAt - previous.recordedAt) / 1000;
      const speedKmh = seconds > 0 ? (meters / seconds) * 3.6 : Infinity;
      if (speedKmh > FILTER.maxSpeedKmh) {
        speedRejectedCount += 1;
        continue;
      }
      const gapMinutes = seconds / 60;
      // Đứng yên trong đại lý cũng không sinh điểm, nên chỉ tính là đứt khi đã đi xa mà không có điểm.
      if (gapMinutes > FILTER.gapMinutes && meters > FILTER.gapMeters) {
        gapCount += 1;
        longestGapMinutes = Math.max(longestGapMinutes, gapMinutes);
      }
      distanceM += meters;
    }
    kept.push({ ...point, cumulativeM: distanceM });
  }

  return {
    kept,
    distanceM,
    poorAccuracyCount,
    speedRejectedCount,
    stopCount,
    gapCount,
    longestGapMinutes,
  };
}

/** Km cộng dồn tại thời điểm `at`, lấy theo điểm giữ lại gần nhất trước đó. */
export function cumulativeAt(kept: readonly KeptPoint[], at: number): number {
  let low = 0;
  let high = kept.length - 1;
  let found = 0;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const point = kept[mid];
    if (!point) break;
    if (point.recordedAt <= at) {
      found = point.cumulativeM;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return found;
}

/** Gán số phiên cho từng điểm. Điểm ghi trước giờ mở phiên tối đa 1 phút vẫn thuộc phiên đó. */
export function segmentOf(sessionStarts: readonly number[], recordedAt: number): number {
  let segment = 0;
  for (let i = 0; i < sessionStarts.length; i += 1) {
    const start = sessionStarts[i];
    if (start !== undefined && recordedAt >= start - 60_000) segment = i;
  }
  return segment;
}
