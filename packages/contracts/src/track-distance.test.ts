import { describe, expect, it } from 'vitest';
import {
  cumulativeAt,
  distanceMeters,
  filterTrack,
  FILTER,
  segmentOf,
  type RawPoint,
} from './track-distance';

// Khoảng 0,000009 độ vĩ là 1 m.
const METER_LAT = 1 / 111_195;
const START = Date.UTC(2026, 10, 12, 1, 0, 0);

function point(seconds: number, northM: number, extra: Partial<RawPoint> = {}): RawPoint {
  return {
    recordedAt: START + seconds * 1000,
    lat: 21 + northM * METER_LAT,
    lng: 105.8,
    accuracy: 10,
    segment: 0,
    ...extra,
  };
}

describe('distanceMeters', () => {
  it('tính đúng khoảng cách 1 km theo vĩ độ', () => {
    expect(distanceMeters(point(0, 0), point(0, 1000))).toBeCloseTo(1000, 0);
  });
});

describe('filterTrack', () => {
  it('cộng đủ quãng đường khi đi thẳng', () => {
    const points = Array.from({ length: 11 }, (_, i) => point(i * 10, i * 100));
    const result = filterTrack(points);
    expect(result.distanceM).toBeCloseTo(1000, 0);
    expect(result.stopCount).toBe(0);
  });

  it('bỏ điểm sai số lớn và điểm không có sai số', () => {
    const result = filterTrack([
      point(0, 0),
      point(10, 500, { accuracy: FILTER.maxAccuracyM + 1 }),
      point(20, 100, { accuracy: null }),
      point(30, 200),
    ]);
    expect(result.poorAccuracyCount).toBe(2);
    expect(result.distanceM).toBeCloseTo(200, 0);
  });

  it('gộp chỗ đứng yên từ 1 phút, không cộng km giả khi vị trí nhảy qua lại', () => {
    const jitter = [0, 20, -15, 25, -20, 18, 0];
    const points = [...jitter.map((m, i) => point(i * 15, m)), point(120, 400)];
    const result = filterTrack(points);
    expect(result.stopCount).toBe(1);
    // Không gộp sẽ ra hơn 600 m vì nhảy qua lại.
    expect(result.distanceM).toBeLessThan(410);
    expect(result.distanceM).toBeGreaterThan(390);
  });

  it('không gộp khi đứng chưa tới 1 phút', () => {
    const result = filterTrack([point(0, 0), point(20, 20), point(40, 0), point(60, 300)]);
    expect(result.stopCount).toBe(0);
  });

  it('không cộng đoạn nối giữa hai phiên ghi', () => {
    const result = filterTrack([
      point(0, 0),
      point(10, 100),
      point(3600, 5000, { segment: 1 }),
      point(3610, 5100, { segment: 1 }),
    ]);
    expect(result.distanceM).toBeCloseTo(200, 0);
  });

  it('bỏ điểm nhảy quá nhanh', () => {
    const result = filterTrack([point(0, 0), point(10, 5000), point(20, 100)]);
    expect(result.speedRejectedCount).toBe(1);
    expect(result.distanceM).toBeCloseTo(100, 0);
  });

  it('đếm đoạn đứt khi đã đi xa mà quá 5 phút không có điểm', () => {
    const result = filterTrack([point(0, 0), point(600, 2000)]);
    expect(result.gapCount).toBe(1);
    expect(result.longestGapMinutes).toBeCloseTo(10, 1);
  });
});

describe('cumulativeAt', () => {
  it('lấy km cộng dồn của điểm gần nhất trước thời điểm', () => {
    const { kept } = filterTrack(Array.from({ length: 5 }, (_, i) => point(i * 10, i * 100)));
    expect(cumulativeAt(kept, START - 1)).toBe(0);
    expect(cumulativeAt(kept, START + 25_000)).toBeCloseTo(200, 0);
    expect(cumulativeAt(kept, START + 999_000)).toBeCloseTo(400, 0);
  });
});

describe('segmentOf', () => {
  it('gán điểm vào phiên đã mở, cho phép sớm 1 phút', () => {
    const starts = [START, START + 3_600_000];
    expect(segmentOf(starts, START + 10_000)).toBe(0);
    expect(segmentOf(starts, START + 3_560_000)).toBe(1);
  });
});
