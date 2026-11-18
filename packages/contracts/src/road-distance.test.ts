import { describe, expect, it } from 'vitest';
import {
  addLegs,
  buildRoadLegs,
  chunkPoints,
  deviationPercent,
  matchRadius,
} from './road-distance';

describe('road distance helpers', () => {
  it('splits long tracks into overlapping chunks so no segment is lost', () => {
    const points = Array.from({ length: 250 }, (_, index) => index);
    const chunks = chunkPoints(points, 100);
    expect(chunks.map((chunk) => [chunk[0], chunk.at(-1)])).toEqual([
      [0, 99],
      [99, 198],
      [198, 249],
    ]);
    expect(chunkPoints([1], 100)).toEqual([]);
    expect(chunkPoints([1, 2], 100)).toEqual([[1, 2]]);
  });

  it('clamps the matching radius to the GPS accuracy range', () => {
    expect(matchRadius(3)).toBe(10);
    expect(matchRadius(25.4)).toBe(25);
    expect(matchRadius(120)).toBe(50);
    expect(matchRadius(null)).toBe(50);
  });

  it('adds legs and keeps the estimated flag', () => {
    expect(
      addLegs([
        { meters: 1000, estimated: false, matchedPoints: 10, totalPoints: 10 },
        { meters: 500, estimated: true, matchedPoints: 0, totalPoints: 2 },
      ]),
    ).toEqual({ meters: 1500, estimated: true, matchedPoints: 10, totalPoints: 12 });
  });

  it('computes deviation against the odometer', () => {
    expect(deviationPercent(10.3, 10)).toBeCloseTo(3, 6);
    expect(deviationPercent(5, 0)).toBeNull();
  });
});

describe('buildRoadLegs', () => {
  const at = (minute: number) => Date.parse('2026-11-16T02:00:00Z') + minute * 60_000;
  it('makes one leg per check-in after the first, with the track points in between', () => {
    const checkIns = [
      { id: 'b', capturedAt: at(30), lat: 21.02, lng: 105.8 },
      { id: 'a', capturedAt: at(0), lat: 21.0, lng: 105.8 },
      { id: 'c', capturedAt: at(60), lat: 21.04, lng: 105.8 },
    ];
    const kept = [at(10), at(20), at(40), at(70)].map((recordedAt, index) => ({
      recordedAt,
      lat: 21 + index * 0.01,
      lng: 105.8,
      accuracy: 8,
    }));
    const legs = buildRoadLegs(checkIns, kept);
    expect(legs.map((leg) => [leg.checkInId, leg.trackPoints, leg.points.length])).toEqual([
      ['b', 2, 4],
      ['c', 1, 3],
    ]);
    expect(legs[0]?.points[0]?.recordedAt).toBe(at(0));
  });

  it('has no leg for a single check-in', () => {
    expect(buildRoadLegs([{ id: 'a', capturedAt: at(0), lat: 21, lng: 105.8 }], [])).toEqual([]);
  });
});
