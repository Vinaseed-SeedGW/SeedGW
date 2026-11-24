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
      seasonYear: null,
      regionId: null,
      provinceName: null,
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

  const MEKONG = '0b6f1a52-61f4-4c0e-9d0b-2a3c7e5f9a11';
  const RED_RIVER = 'c3d9e2a7-8b14-4f6e-a1d2-5e7f8a9b0c12';

  it('kỳ Vụ: vụ lặp lại hằng năm, niên vụ gần nhất đã bắt đầu, chọn được 2 niên vụ trước', () => {
    const seasons = [
      {
        id: '7f1e7f0a-3c55-4f2a-9a43-5c1a8d2f3b10',
        name: 'Đông Xuân, ĐBSCL',
        startDay: 5,
        startMonth: 11,
        endDay: 15,
        endMonth: 3,
        regionId: MEKONG,
      },
      {
        id: '1b4e28ba-2fa1-41d2-883f-0016d3cca427',
        name: 'Hè Thu, ĐBSCL',
        startDay: 1,
        startMonth: 4,
        endDay: 15,
        endMonth: 8,
        regionId: null,
      },
    ];
    const now = new Date('2026-11-23T03:00:00Z');
    expect(dashboardUrlParams(now, seasons).parse({ ky: 'vu' })).toMatchObject({
      period: 'vu',
      from: '2026-11-05',
      to: today,
      seasonId: seasons[0]?.id,
      seasonYear: 2026,
    });
    // Vụ chưa tới trong năm nay thì lấy lần gần nhất đã qua.
    expect(dashboardUrlParams(now, seasons).parse({ ky: 'vu', vu: seasons[1]?.id })).toMatchObject({
      from: '2026-04-01',
      to: '2026-08-15',
      seasonYear: 2026,
    });
    expect(
      dashboardUrlParams(now, seasons).parse({ ky: 'vu', vu: seasons[0]?.id, 'nien-vu': '2025' }),
    ).toMatchObject({ from: '2025-11-05', to: '2026-03-15', seasonYear: 2025 });
    // Niên vụ ngoài 3 lần gần nhất về lần gần nhất.
    expect(
      dashboardUrlParams(now, seasons).parse({ ky: 'vu', vu: seasons[0]?.id, 'nien-vu': '2019' }),
    ).toMatchObject({ seasonYear: 2026 });
    expect(dashboardUrlParams(now, []).parse({ ky: 'vu' })).toMatchObject({
      period: 'thang-nay',
      seasonId: null,
    });
  });

  it('Vùng, Tỉnh: tỉnh ngoài vùng bị bỏ, vụ lọc theo vùng của tỉnh', () => {
    const seasons = [
      {
        id: '7f1e7f0a-3c55-4f2a-9a43-5c1a8d2f3b10',
        name: 'Đông Xuân, ĐBSCL',
        startDay: 5,
        startMonth: 11,
        endDay: 15,
        endMonth: 3,
        regionId: MEKONG,
      },
      {
        id: '5d8a3b1c-2e4f-4a6b-8c9d-0e1f2a3b4c5d',
        name: 'Đông Xuân, Đồng bằng sông Hồng',
        startDay: 15,
        startMonth: 2,
        endDay: 1,
        endMonth: 6,
        regionId: RED_RIVER,
      },
    ];
    const provinces = [
      { name: 'Thành phố Cần Thơ', regionId: MEKONG },
      { name: 'Thành phố Hà Nội', regionId: RED_RIVER },
    ] as const;
    const now = new Date('2026-11-23T03:00:00Z');
    const parse = (raw: Record<string, string>) =>
      dashboardUrlParams(now, seasons, provinces).parse(raw);
    expect(parse({ tinh: 'can-tho' })).toMatchObject({
      regionId: null,
      provinceName: 'Thành phố Cần Thơ',
    });
    expect(parse({ vung: RED_RIVER, tinh: 'can-tho' })).toMatchObject({
      regionId: RED_RIVER,
      provinceName: null,
    });
    expect(parse({ tinh: 'khong-co' })).toMatchObject({ provinceName: null });
    // Chọn tỉnh Hà Nội: kỳ Vụ chỉ chọn vụ của Đồng bằng sông Hồng.
    expect(parse({ ky: 'vu', tinh: 'ha-noi' })).toMatchObject({
      seasonId: seasons[1]?.id,
      from: '2026-02-15',
      to: '2026-06-01',
    });
    expect(parse({ ky: 'vu', vung: RED_RIVER, vu: seasons[0]?.id ?? '' })).toMatchObject({
      seasonId: seasons[1]?.id,
    });
  });
});
