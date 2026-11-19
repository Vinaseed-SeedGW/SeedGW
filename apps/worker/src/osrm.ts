import {
  addLegs,
  chunkPoints,
  matchRadius,
  type RoadLeg,
  type RoadPoint,
} from '@seedgw/contracts/road-distance';
import { distanceMeters } from '@seedgw/contracts/track-distance';

/**
 * Lớp tính km theo đường đi thật (R4, kế hoạch check-in): đổi nhà cung cấp (OSRM tự dựng, Vietmap) không
 * phải sửa báo cáo. Vị trí nhân viên không gửi ra ngoài khi dùng OSRM nội bộ.
 */
export interface RoadDistanceProvider {
  /** Km theo đường của một chặng vết GPS (đã lọc), theo thứ tự thời gian. */
  legDistance(points: readonly RoadPoint[]): Promise<RoadLeg>;
}

const TIMEOUT_MS = 15_000;

type OsrmMatch = {
  code: string;
  matchings?: Array<{ distance: number }>;
  tracepoints?: Array<{ matchings_index: number; waypoint_index: number } | null>;
};
type OsrmRoute = { code: string; routes?: Array<{ distance: number }> };

async function getJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    // OSRM trả 400 kèm code NoMatch, NoRoute: vẫn đọc JSON để xử lý.
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

const coordinate = (point: { lat: number; lng: number }) =>
  `${point.lng.toFixed(6)},${point.lat.toFixed(6)}`;

export class OsrmRoadDistance implements RoadDistanceProvider {
  constructor(private readonly baseUrl: string) {}

  /** Đường ngắn nhất giữa hai điểm, dùng nối đoạn mất vết; không tìm được thì lấy đường chim bay. */
  async routeMeters(from: RoadPoint, to: RoadPoint): Promise<number> {
    const url = `${this.baseUrl}/route/v1/driving/${coordinate(from)};${coordinate(to)}?overview=false`;
    const body = await getJson<OsrmRoute>(url);
    return body.code === 'Ok' && body.routes?.[0]
      ? body.routes[0].distance
      : distanceMeters(from, to);
  }

  private async matchChunk(points: readonly RoadPoint[]): Promise<RoadLeg> {
    const params = new URLSearchParams({
      timestamps: points.map((point) => Math.round(point.recordedAt / 1000)).join(';'),
      radiuses: points.map((point) => matchRadius(point.accuracy)).join(';'),
      // Không cắt vết theo khoảng thời gian: chỗ đứng yên đã gộp tạo khoảng trống vài phút mà không phải mất vết.
      // OSRM vẫn tự tách khi không khớp nổi, khi đó nối bằng đường ngắn nhất và ghi ước tính.
      gaps: 'ignore',
      tidy: 'true',
      overview: 'false',
    });
    const url = `${this.baseUrl}/match/v1/driving/${points.map(coordinate).join(';')}?${params.toString()}`;
    const body = await getJson<OsrmMatch>(url);
    if (body.code !== 'Ok' || !body.matchings?.length || !body.tracepoints) {
      // Không khớp được vào đường nào: nối hai đầu bằng đường ngắn nhất, ghi ước tính.
      const first = points[0];
      const last = points[points.length - 1];
      const meters = first && last ? await this.routeMeters(first, last) : 0;
      return { meters, estimated: true, matchedPoints: 0, totalPoints: points.length };
    }

    let meters = body.matchings.reduce((sum, matching) => sum + matching.distance, 0);
    let estimated = false;
    // Vết bị tách thành nhiều đoạn (mất vết, điểm không khớp): nối đầu cuối các đoạn bằng đường ngắn nhất.
    const lastOfMatching = new Map<number, number>();
    const firstOfMatching = new Map<number, number>();
    body.tracepoints.forEach((trace, index) => {
      if (!trace) return;
      if (!firstOfMatching.has(trace.matchings_index))
        firstOfMatching.set(trace.matchings_index, index);
      lastOfMatching.set(trace.matchings_index, index);
    });
    for (let matching = 1; matching < body.matchings.length; matching += 1) {
      const endIndex = lastOfMatching.get(matching - 1);
      const startIndex = firstOfMatching.get(matching);
      const end = endIndex !== undefined ? points[endIndex] : undefined;
      const start = startIndex !== undefined ? points[startIndex] : undefined;
      if (end && start) {
        meters += await this.routeMeters(end, start);
        estimated = true;
      }
    }
    const matchedPoints = body.tracepoints.filter((trace) => trace !== null).length;
    return { meters, estimated, matchedPoints, totalPoints: points.length };
  }

  async legDistance(points: readonly RoadPoint[]): Promise<RoadLeg> {
    const legs: RoadLeg[] = [];
    for (const chunk of chunkPoints(points)) legs.push(await this.matchChunk(chunk));
    return addLegs(legs);
  }
}

/** null khi chưa cấu hình máy chủ tìm đường (OSRM_URL); khi đó báo cáo chỉ có km theo GPS. */
export function roadDistanceProvider(): RoadDistanceProvider | null {
  const url = process.env.OSRM_URL?.trim().replace(/\/$/, '');
  return url ? new OsrmRoadDistance(url) : null;
}
