import { describe, expect, it } from 'vitest';
import {
  changePercent,
  dashboardUrlParams,
  lastYearRange,
  monthsInRange,
  periodRange,
  previousRange,
} from './dashboard';
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
      seasonId: null,
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

describe('kỳ mới và so sánh (K4)', () => {
  const today = '2026-11-23'; // thứ Hai

  it('tuần tính từ thứ Hai, quý, năm', () => {
    expect(periodRange('tuan-nay', today)).toEqual({ from: '2026-11-23', to: today });
    expect(periodRange('tuan-nay', '2026-11-29')).toEqual({ from: '2026-11-23', to: '2026-11-29' });
    expect(periodRange('quy-nay', today)).toEqual({ from: '2026-10-01', to: today });
    expect(periodRange('nam-nay', today)).toEqual({ from: '2026-01-01', to: today });
  });

  it('kỳ trước cùng số ngày và cùng kỳ năm trước', () => {
    expect(previousRange('2026-11-01', '2026-11-23')).toEqual({
      from: '2026-10-09',
      to: '2026-10-31',
    });
    expect(lastYearRange('2028-02-29', '2028-03-10')).toEqual({
      from: '2027-02-28',
      to: '2027-03-10',
    });
    expect(changePercent(120, 100)).toBe(20);
    expect(changePercent(5, 0)).toBeNull();
  });

  it('các tháng trong kỳ, qua năm mới', () => {
    expect(monthsInRange('2026-11-01', '2027-02-10')).toEqual([
      '2026-11',
      '2026-12',
      '2027-01',
      '2027-02',
    ]);
  });

  it('kỳ Vụ: vụ đã chọn, không chọn thì vụ đang diễn ra; chưa có vụ thì về Tháng này', () => {
    const seasons = [
      {
        id: '7f1e7f0a-3c55-4f2a-9a43-5c1a8d2f3b10',
        name: 'Đông Xuân',
        startDate: '2026-11-01',
        endDate: '2027-05-30',
      },
      {
        id: '1b4e28ba-2fa1-41d2-883f-0016d3cca427',
        name: 'Hè Thu',
        startDate: '2026-05-01',
        endDate: '2026-09-30',
      },
    ];
    const now = new Date('2026-11-23T03:00:00Z');
    expect(dashboardUrlParams(now, seasons).parse({ ky: 'vu' })).toMatchObject({
      period: 'vu',
      from: '2026-11-01',
      to: today,
      seasonId: seasons[0]?.id,
    });
    expect(dashboardUrlParams(now, seasons).parse({ ky: 'vu', vu: seasons[1]?.id })).toMatchObject({
      from: '2026-05-01',
      to: '2026-09-30',
    });
    expect(dashboardUrlParams(now, []).parse({ ky: 'vu' })).toMatchObject({
      period: 'thang-nay',
      seasonId: null,
    });
  });
});
