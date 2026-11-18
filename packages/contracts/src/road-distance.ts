// R4: phần tính km theo đường đi thật dùng chung, không phụ thuộc nhà cung cấp (OSRM tự dựng hoặc Vietmap).

export type RoadPoint = { recordedAt: number; lat: number; lng: number; accuracy: number | null };

/** Mỗi lần gửi khớp đường tối đa ngần này điểm; hai lần liền nhau dùng chung một điểm để không hở. */
export const MATCH_CHUNK_SIZE = 100;
/** Bán kính tìm đường quanh mỗi điểm GPS: theo sai số máy báo, kẹp trong khoảng này (mét). */
export const MATCH_RADIUS_MIN_M = 10;
export const MATCH_RADIUS_MAX_M = 50;

export function chunkPoints<T>(points: readonly T[], size = MATCH_CHUNK_SIZE): T[][] {
  if (points.length <= size) return points.length > 1 ? [[...points]] : [];
  const chunks: T[][] = [];
  for (let start = 0; start < points.length - 1; start += size - 1) {
    chunks.push(points.slice(start, start + size));
  }
  return chunks.filter((chunk) => chunk.length > 1);
}

export function matchRadius(accuracy: number | null): number {
  if (accuracy === null || !Number.isFinite(accuracy)) return MATCH_RADIUS_MAX_M;
  return Math.min(MATCH_RADIUS_MAX_M, Math.max(MATCH_RADIUS_MIN_M, Math.round(accuracy)));
}

/** Kết quả một chặng: số mét theo đường, và có phần nào phải ước tính (nối đoạn mất vết) hay không. */
export type RoadLeg = {
  meters: number;
  estimated: boolean;
  matchedPoints: number;
  totalPoints: number;
};

export function addLegs(legs: readonly RoadLeg[]): RoadLeg {
  return legs.reduce<RoadLeg>(
    (sum, leg) => ({
      meters: sum.meters + leg.meters,
      estimated: sum.estimated || leg.estimated,
      matchedPoints: sum.matchedPoints + leg.matchedPoints,
      totalPoints: sum.totalPoints + leg.totalPoints,
    }),
    { meters: 0, estimated: false, matchedPoints: 0, totalPoints: 0 },
  );
}

/** Lệch phần trăm so với số đồng hồ xe (số dương là hệ thống tính dài hơn). */
export function deviationPercent(systemKm: number, odometerKm: number): number | null {
  if (odometerKm <= 0) return null;
  return ((systemKm - odometerKm) / odometerKm) * 100;
}

export type RoadCheckIn = { id: string; capturedAt: number; lat: number; lng: number };

/**
 * Chia vết một ngày thành chặng giữa hai lượt check-in liền nhau (V1b). Mỗi chặng gồm điểm check-in trước,
 * các điểm GPS đã lọc ở giữa, và điểm check-in sau. Lượt đầu ngày không có chặng (km bằng 0, như mẫu cũ).
 */
export function buildRoadLegs(
  checkIns: readonly RoadCheckIn[],
  kept: readonly RoadPoint[],
): Array<{ checkInId: string; points: RoadPoint[]; trackPoints: number }> {
  const sorted = [...checkIns].sort((a, b) => a.capturedAt - b.capturedAt);
  const legs: Array<{ checkInId: string; points: RoadPoint[]; trackPoints: number }> = [];
  for (let index = 1; index < sorted.length; index += 1) {
    const from = sorted[index - 1];
    const to = sorted[index];
    if (!from || !to) continue;
    const between = kept.filter(
      (point) => point.recordedAt > from.capturedAt && point.recordedAt < to.capturedAt,
    );
    legs.push({
      checkInId: to.id,
      points: [
        { recordedAt: from.capturedAt, lat: from.lat, lng: from.lng, accuracy: null },
        ...between,
        { recordedAt: to.capturedAt, lat: to.lat, lng: to.lng, accuracy: null },
      ],
      trackPoints: between.length,
    });
  }
  return legs;
}

/** Tên hàng đợi và khoá gom việc theo người, theo ngày (dùng chung giữa web xếp lịch và worker). */
export const ROAD_DISTANCE_QUEUE = 'road-distance';
/** Chờ ngần này sau lần nhận dữ liệu cuối mới tính, để gom nhiều lần app gửi (duyệt 18/11/2026). */
export const ROAD_DISTANCE_DEBOUNCE_MS = 3 * 60_000;
export type RoadDistanceJob = { userId: string; day: string };

export function roadDistanceJobId(job: RoadDistanceJob): string {
  return `${job.userId}:${job.day}`;
}
