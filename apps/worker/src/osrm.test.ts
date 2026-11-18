import { afterEach, describe, expect, it, vi } from 'vitest';

const { OsrmRoadDistance } = await import('./osrm');

const point = (seconds: number, lat: number) => ({
  recordedAt: Date.parse('2026-11-12T01:00:00Z') + seconds * 1000,
  lat,
  lng: 105.8,
  accuracy: 8,
});

function respond(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
}

afterEach(() => vi.unstubAllGlobals());

describe('OsrmRoadDistance', () => {
  it('sums matched distance and sends timestamps and radiuses', async () => {
    const fetchMock = vi.fn((url: string) => {
      expect(url).toContain('/match/v1/driving/');
      expect(url).toContain('gaps=ignore');
      expect(url).toContain('radiuses=10%3B10');
      return respond({
        code: 'Ok',
        matchings: [{ distance: 1234 }],
        tracepoints: [
          { matchings_index: 0, waypoint_index: 0 },
          { matchings_index: 0, waypoint_index: 1 },
        ],
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    const leg = await new OsrmRoadDistance('http://osrm:5000').legDistance([
      point(0, 21),
      point(60, 21.01),
    ]);
    expect(leg).toEqual({ meters: 1234, estimated: false, matchedPoints: 2, totalPoints: 2 });
  });

  it('joins split matchings with the shortest route and marks the leg estimated', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        url.includes('/match/')
          ? respond({
              code: 'Ok',
              matchings: [{ distance: 1000 }, { distance: 2000 }],
              tracepoints: [
                { matchings_index: 0, waypoint_index: 0 },
                { matchings_index: 0, waypoint_index: 1 },
                null,
                { matchings_index: 1, waypoint_index: 0 },
                { matchings_index: 1, waypoint_index: 1 },
              ],
            })
          : respond({ code: 'Ok', routes: [{ distance: 500 }] }),
      ),
    );
    const leg = await new OsrmRoadDistance('http://osrm:5000').legDistance(
      [0, 1, 2, 3, 4].map((index) => point(index * 30, 21 + index * 0.01)),
    );
    expect(leg).toEqual({ meters: 3500, estimated: true, matchedPoints: 4, totalPoints: 5 });
  });

  it('falls back to the shortest route between both ends when nothing matches', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        url.includes('/match/')
          ? respond({ code: 'NoMatch' })
          : respond({ code: 'Ok', routes: [{ distance: 777 }] }),
      ),
    );
    const leg = await new OsrmRoadDistance('http://osrm:5000').legDistance([
      point(0, 21),
      point(60, 21.01),
    ]);
    expect(leg).toEqual({ meters: 777, estimated: true, matchedPoints: 0, totalPoints: 2 });
  });
});
