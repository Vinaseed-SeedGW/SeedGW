import { describe, expect, it } from 'vitest';
import { resolveSystemSettings } from './settings';
import { filterTrack, type RawPoint } from './track-distance';
import {
  DEFAULT_TRACKING_SETTINGS,
  trackFilterOf,
  trackingSettingsFrom,
} from './tracking-settings';

// Khoảng 1 m theo vĩ độ là 0,000009 độ.
const M = 0.000009;
const point = (seconds: number, metersNorth: number, accuracy = 10): RawPoint => ({
  recordedAt: Date.parse('2026-11-18T01:00:00Z') + seconds * 1000,
  lat: 21 + metersNorth * M,
  lng: 105.8,
  accuracy,
  segment: 0,
});

describe('tracking settings', () => {
  it('defaults match the old fixed filter, so km stays the same', () => {
    expect(trackingSettingsFrom(resolveSystemSettings({}))).toEqual(DEFAULT_TRACKING_SETTINGS);
    const track = [point(0, 0), point(30, 30), point(60, 0), point(90, 30), point(120, 400)];
    expect(filterTrack(track, trackFilterOf(DEFAULT_TRACKING_SETTINGS)).distanceM).toBeCloseTo(
      filterTrack(track).distanceM,
      6,
    );
  });

  it('a wider stop radius merges more jitter and gives fewer km', () => {
    // Đứng yên 2 phút, GPS nhảy 60 m qua lại, rồi đi 500 m.
    const track = [
      point(0, 0),
      point(30, 60),
      point(60, 0),
      point(90, 60),
      point(120, 0),
      point(180, 500),
    ];
    const narrow = filterTrack(
      track,
      trackFilterOf({ ...DEFAULT_TRACKING_SETTINGS, stopRadiusM: 40 }),
    );
    const wide = filterTrack(
      track,
      trackFilterOf({ ...DEFAULT_TRACKING_SETTINGS, stopRadiusM: 80 }),
    );
    expect(wide.stopCount).toBe(1);
    expect(wide.distanceM).toBeLessThan(narrow.distanceM);
  });

  it('a stricter accuracy limit drops more points', () => {
    const track = [point(0, 0, 10), point(30, 300, 70), point(60, 600, 10)];
    expect(filterTrack(track, trackFilterOf(DEFAULT_TRACKING_SETTINGS)).poorAccuracyCount).toBe(1);
    expect(
      filterTrack(track, trackFilterOf({ ...DEFAULT_TRACKING_SETTINGS, maxAccuracyM: 100 }))
        .poorAccuracyCount,
    ).toBe(0);
  });
});
