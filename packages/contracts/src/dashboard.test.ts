import { describe, expect, it } from 'vitest';
import { dashboardUrlParams, periodRange } from './dashboard';
import { visitCutoffs } from './dealers';

describe('periodRange', () => {
  it('tính khoảng ngày theo kỳ', () => {
    expect(periodRange('hom-nay', '2026-11-17')).toEqual({ from: '2026-11-17', to: '2026-11-17' });
    expect(periodRange('7-ngay', '2026-11-17')).toEqual({ from: '2026-11-11', to: '2026-11-17' });
    expect(periodRange('thang-nay', '2026-11-17')).toEqual({
      from: '2026-11-01',
      to: '2026-11-17',
    });
    expect(periodRange('thang-truoc', '2026-11-17')).toEqual({
      from: '2026-10-01',
      to: '2026-10-31',
    });
    expect(periodRange('thang-truoc', '2026-01-05')).toEqual({
      from: '2025-12-01',
      to: '2025-12-31',
    });
  });

  it('kỳ tuỳ chọn không vượt hôm nay, không quá 366 ngày, đổi chỗ khi từ sau đến', () => {
    expect(periodRange('tuy-chon', '2026-11-17', { from: '2026-11-10', to: '2026-12-01' })).toEqual(
      { from: '2026-11-10', to: '2026-11-17' },
    );
    expect(
      periodRange('tuy-chon', '2026-11-17', { from: '2020-01-01', to: '2026-11-17' }).from,
    ).toBe('2025-11-17');
    expect(periodRange('tuy-chon', '2026-11-17', { from: '2026-11-15', to: '2026-11-12' })).toEqual(
      { from: '2026-11-12', to: '2026-11-12' },
    );
  });
});

describe('dashboardUrlParams', () => {
  const now = new Date('2026-11-17T03:00:00Z');
  it('mặc định Tháng này, đọc đơn vị, nhân viên, cấp', () => {
    expect(dashboardUrlParams(now).parse({})).toEqual({
      period: 'thang-nay',
      from: '2026-11-01',
      to: '2026-11-17',
      orgUnitId: null,
      employeeCode: null,
      level: null,
    });
    const parsed = dashboardUrlParams(now).parse({ ky: '7-ngay', 'nhan-vien': 'KD001', cap: '2' });
    expect(parsed.period).toBe('7-ngay');
    expect(parsed.employeeCode).toBe('KD001');
    expect(parsed.level).toBe(2);
    expect(dashboardUrlParams(now).parse({ ky: 'x', cap: '9' }).level).toBeNull();
  });
});

describe('visitCutoffs', () => {
  it('lùi số ngày theo từng cấp', () => {
    const cutoffs = visitCutoffs(
      { level1: 14, level2: 30, level3: 45 },
      new Date('2026-11-17T00:00:00Z'),
    );
    expect(cutoffs[1].toISOString()).toBe('2026-11-03T00:00:00.000Z');
    expect(cutoffs[3].toISOString()).toBe('2026-10-03T00:00:00.000Z');
  });
});
