import { describe, expect, it } from 'vitest';
import {
  activeSeason,
  crossesYear,
  latestStartYear,
  parseDayMonth,
  seasonDays,
  seasonOccurrence,
  seasonYearLabel,
  upsertSeasonInput,
} from './seasons';
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

describe('lịch vụ lặp lại hằng năm', () => {
  const dongXuan = { startDay: 5, startMonth: 11, endDay: 15, endMonth: 3 };
  const heThu = { startDay: 1, startMonth: 4, endDay: 15, endMonth: 8 };

  it('đọc dd/mm, không nhận 29/02 và ngày sai', () => {
    expect(parseDayMonth('5/11')).toEqual({ day: 5, month: 11 });
    expect(parseDayMonth('29/02')).toBeNull();
    expect(parseDayMonth('31/04')).toBeNull();
    expect(
      upsertSeasonInput.parse({
        id: null,
        name: 'Đông Xuân, ĐBSCL',
        regionId: null,
        start: '05/11',
        end: '15/03',
        note: '',
      }),
    ).toMatchObject({ startDay: 5, startMonth: 11, endDay: 15, endMonth: 3 });
  });

  it('vụ sang năm, số ngày, nhãn niên vụ', () => {
    expect(crossesYear(dongXuan)).toBe(true);
    expect(crossesYear(heThu)).toBe(false);
    expect(seasonDays(dongXuan)).toBe(131);
    expect(seasonOccurrence(dongXuan, 2026)).toEqual({ from: '2026-11-05', to: '2027-03-15' });
    expect(seasonYearLabel(dongXuan, 2026)).toBe('2026-2027');
    expect(seasonYearLabel(heThu, 2027)).toBe('2027');
  });

  it('lần gần nhất đã bắt đầu và vụ đang diễn ra', () => {
    expect(latestStartYear(dongXuan, '2026-11-23')).toBe(2026);
    expect(latestStartYear(dongXuan, '2027-02-10')).toBe(2026);
    expect(latestStartYear(heThu, '2026-11-23')).toBe(2026);
    expect(latestStartYear(heThu, '2027-03-01')).toBe(2026);
    const seasons = [
      { name: 'A', ...dongXuan },
      { name: 'B', ...heThu },
    ];
    expect(activeSeason(seasons, '2027-01-10')?.name).toBe('A');
    expect(activeSeason(seasons, '2027-05-01')?.name).toBe('B');
    expect(activeSeason(seasons, '2027-10-01')).toBeNull();
  });
});
