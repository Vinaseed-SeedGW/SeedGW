import { describe, expect, it } from 'vitest';
import { seasonDays, seasonOn, upsertSeasonInput } from './seasons';
import {
  assignableMonths,
  effectiveUnitTarget,
  effectiveUserTarget,
  parseImportKind,
  parseImportMonth,
} from './target-assignments';

describe('chỉ tiêu hiệu lực', () => {
  const assigned = { visitCountTarget: 100, dealerCoverageTarget: 40 };
  const self = { visitCountTarget: 80, dealerCoverageTarget: 30 };

  it('nhân viên: chỉ tiêu được giao thay chỉ tiêu tự đăng ký', () => {
    expect(effectiveUserTarget(assigned, self)).toEqual({ ...assigned, source: 'ASSIGNED' });
    expect(effectiveUserTarget(null, self)).toEqual({ ...self, source: 'SELF' });
    expect(effectiveUserTarget(null, null)).toBeNull();
  });

  it('đơn vị: chưa giao thì cộng chỉ tiêu nhân viên, bỏ người chưa có', () => {
    expect(effectiveUnitTarget(assigned, [self])).toEqual({ ...assigned, source: 'ASSIGNED' });
    expect(effectiveUnitTarget(null, [self, null, assigned])).toEqual({
      visitCountTarget: 180,
      dealerCoverageTarget: 70,
      source: 'SUM',
    });
    expect(effectiveUnitTarget(null, [null])).toBeNull();
  });
});

describe('tháng giao chỉ tiêu', () => {
  it('tháng này và 2 tháng sau, qua năm mới', () => {
    expect(assignableMonths(Date.parse('2026-11-23T03:00:00Z'))).toEqual([
      '2026-11',
      '2026-12',
      '2027-01',
    ]);
  });

  it('đọc tháng và loại trong file Excel', () => {
    expect(parseImportMonth('12/2026')).toBe('2026-12');
    expect(parseImportMonth('1/2027')).toBe('2027-01');
    expect(parseImportMonth('2026-12')).toBe('2026-12');
    expect(parseImportMonth('13/2026')).toBeNull();
    expect(parseImportKind('Đơn vị')).toBe('UNIT');
    expect(parseImportKind(' nhân viên ')).toBe('USER');
    expect(parseImportKind('NV')).toBeNull();
  });
});

describe('lịch vụ', () => {
  it('tính số ngày cả hai đầu', () => {
    expect(seasonDays('2026-12-01', '2026-12-31')).toBe(31);
  });

  it('nhận ngày dd/mm/yyyy, chặn kết thúc trước bắt đầu và vụ quá 366 ngày', () => {
    const base = { id: null, name: 'Đông Xuân 2026-2027', note: '' };
    expect(
      upsertSeasonInput.parse({ ...base, startDate: '01/12/2026', endDate: '30/04/2027' }),
    ).toMatchObject({ startDate: '2026-12-01', endDate: '2027-04-30' });
    expect(
      upsertSeasonInput.safeParse({ ...base, startDate: '30/04/2027', endDate: '01/12/2026' })
        .success,
    ).toBe(false);
    expect(
      upsertSeasonInput.safeParse({ ...base, startDate: '01/01/2026', endDate: '05/01/2027' })
        .success,
    ).toBe(false);
  });

  it('chọn vụ chứa ngày, vụ bắt đầu muộn hơn được ưu tiên khi chồng nhau', () => {
    const seasons = [
      { name: 'A', startDate: '2026-12-01', endDate: '2027-04-30' },
      { name: 'B', startDate: '2027-04-15', endDate: '2027-08-31' },
    ];
    expect(seasonOn(seasons, '2027-01-10')?.name).toBe('A');
    expect(seasonOn(seasons, '2027-04-20')?.name).toBe('B');
    expect(seasonOn(seasons, '2027-10-01')).toBeNull();
  });
});
