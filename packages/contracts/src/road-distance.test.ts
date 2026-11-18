import { describe, expect, it } from 'vitest';
import { addLegs, chunkPoints, deviationPercent, matchRadius } from './road-distance';

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
