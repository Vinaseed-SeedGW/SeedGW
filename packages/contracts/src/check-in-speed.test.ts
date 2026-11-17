import { describe, expect, it } from 'vitest';
import { speedFlaggedIds } from './check-in-speed';

// Khoảng 1 km theo vĩ độ là 0,009 độ.
const KM = 0.009;
const at = (minutes: number) => Date.parse('2026-11-18T01:00:00Z') + minutes * 60_000;
const point = (id: string, minutes: number, kmNorth: number) => ({
  id,
  capturedAt: at(minutes),
  lat: 21 + kmNorth * KM,
  lng: 105.8,
});

describe('speedFlaggedIds', () => {
  it('flags 30 km in 10 minutes but not 20 km in an hour', () => {
    const flagged = speedFlaggedIds(
      [point('a', 0, 0), point('b', 10, 30), point('c', 70, 50)],
      120,
    );
    expect([...flagged]).toEqual(['b']);
  });

  it('ignores hops shorter than 2 km even when the time gap is tiny', () => {
    expect(speedFlaggedIds([point('a', 0, 0), point('b', 0.5, 1.5)], 120).size).toBe(0);
  });

  it('sorts check-ins that arrived late before comparing', () => {
    const flagged = speedFlaggedIds(
      [point('late', 10, 30), point('first', 0, 0), point('next', 70, 50)],
      120,
    );
    expect([...flagged]).toEqual(['late']);
  });

  it('flags two far apart check-ins at the same minute', () => {
    expect([...speedFlaggedIds([point('a', 5, 0), point('b', 5, 10)], 120)]).toEqual(['b']);
  });

  it('respects the configured threshold', () => {
    const points = [point('a', 0, 0), point('b', 30, 50)]; // 100 km/h
    expect(speedFlaggedIds(points, 120).size).toBe(0);
    expect([...speedFlaggedIds(points, 80)]).toEqual(['b']);
  });
});
