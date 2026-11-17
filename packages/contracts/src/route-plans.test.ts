import { describe, expect, it } from 'vitest';
import {
  editableRoutePeriods,
  formatRoutePeriod,
  mapsDirectionLinks,
  mondayOf,
  routeDeadline,
  routePeriodDays,
  sortByNearest,
  submitRoutePlanInput,
} from './route-plans';

const DEALER_A = '11111111-1111-4111-8111-111111111111';
const DEALER_B = '22222222-2222-4222-8222-222222222222';

describe('route periods', () => {
  it('finds Monday and the six working days of a week', () => {
    expect(mondayOf('2026-11-22')).toBe('2026-11-16'); // Chủ nhật thuộc tuần trước đó
    expect(mondayOf('2026-11-18')).toBe('2026-11-16');
    expect(routePeriodDays('WEEKLY', '2026-11-16')).toEqual([
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
      '2026-11-19',
      '2026-11-20',
      '2026-11-21',
    ]);
    expect(formatRoutePeriod('WEEKLY', '2026-11-23')).toBe('Tuần 23/11 đến 28/11/2026');
    expect(formatRoutePeriod('DAILY', '2026-11-18')).toBe('Ngày Thứ Tư 18/11/2026');
  });

  it('allows this week and next week, or today and the next 7 days (VN time)', () => {
    // 17/11/2026 23:30 giờ VN vẫn là thứ Ba.
    const now = new Date('2026-11-17T16:30:00Z');
    expect(editableRoutePeriods('WEEKLY', now)).toEqual(['2026-11-16', '2026-11-23']);
    const daily = editableRoutePeriods('DAILY', now);
    expect(daily[0]).toBe('2026-11-17');
    expect(daily.at(-1)).toBe('2026-11-24');
  });

  it('puts the deadline at the configured hour on Friday before, or the day before', () => {
    const hours = { weekly: 17, daily: 17 };
    expect(routeDeadline('WEEKLY', '2026-11-23', hours).toISOString()).toBe(
      '2026-11-20T10:00:00.000Z',
    );
    expect(routeDeadline('DAILY', '2026-11-18', hours).toISOString()).toBe(
      '2026-11-17T10:00:00.000Z',
    );
  });
});

describe('submit route input', () => {
  it('rejects weekly routes not starting on Monday, days outside the period and duplicates', () => {
    const base = { kind: 'WEEKLY' as const, periodStart: '2026-11-23', note: '' };
    expect(
      submitRoutePlanInput.safeParse({
        ...base,
        days: [{ day: '2026-11-24', dealerIds: [DEALER_A] }],
      }).success,
    ).toBe(true);
    expect(
      submitRoutePlanInput.safeParse({
        ...base,
        periodStart: '2026-11-24',
        days: [{ day: '2026-11-24', dealerIds: [DEALER_A] }],
      }).success,
    ).toBe(false);
    expect(
      submitRoutePlanInput.safeParse({
        ...base,
        days: [{ day: '2026-11-29', dealerIds: [DEALER_A] }],
      }).success,
    ).toBe(false);
    expect(
      submitRoutePlanInput.safeParse({
        ...base,
        days: [{ day: '2026-11-24', dealerIds: [DEALER_A, DEALER_A] }],
      }).success,
    ).toBe(false);
    expect(
      submitRoutePlanInput.safeParse({ ...base, days: [{ day: '2026-11-24', dealerIds: [] }] })
        .success,
    ).toBe(false);
    expect(
      submitRoutePlanInput.safeParse({
        ...base,
        days: [{ day: '2026-11-24', dealerIds: [DEALER_A, DEALER_B] }],
      }).success,
    ).toBe(true);
  });
});

describe('maps helpers', () => {
  const stop = (index: number, lat: number | null = 21 + index / 100) => ({
    dealerName: `Đại lý ${index}`,
    address: `Số ${index} Phố Huế`,
    lat,
    lng: lat === null ? null : 105.8,
  });

  it('splits directions into links of about 10 points, chaining from the previous end', () => {
    const stops = Array.from({ length: 23 }, (_, index) => stop(index));
    const links = mapsDirectionLinks(stops);
    expect(links.map((link) => [link.from, link.to])).toEqual([
      [1, 10],
      [11, 20],
      [21, 23],
    ]);
    const second = new URL(links[1]?.url ?? '');
    expect(second.searchParams.get('origin')).toBe('21.09,105.8');
    expect(second.searchParams.get('destination')).toBe('21.19,105.8');
    expect(second.searchParams.get('waypoints')?.split('|')).toHaveLength(9);
    expect(new URL(links[0]?.url ?? '').searchParams.get('origin')).toBeNull();
  });

  it('uses the address when a dealer has no coordinates', () => {
    const [link] = mapsDirectionLinks([stop(1, null)]);
    expect(new URL(link?.url ?? '').searchParams.get('destination')).toBe('Số 1 Phố Huế');
  });

  it('orders by nearest next point and keeps dealers without coordinates last', () => {
    const points = [
      { id: 'far', lat: 21.1, lng: 105.8 },
      { id: 'none', lat: null, lng: null },
      { id: 'near', lat: 21.01, lng: 105.8 },
      { id: 'mid', lat: 21.05, lng: 105.8 },
    ];
    expect(sortByNearest(points, { lat: 21, lng: 105.8 }).map((p) => p.id)).toEqual([
      'near',
      'mid',
      'far',
      'none',
    ]);
  });
});
