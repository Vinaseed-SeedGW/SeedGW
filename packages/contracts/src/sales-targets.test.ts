import { describe, expect, it } from 'vitest';
import {
  currentVnMonth,
  editableTargetMonths,
  formatMonthLabel,
  isEditableTargetMonth,
  monthBoundsUtc,
  upsertSalesTargetInput,
} from './sales-targets';

describe('sales-targets contracts', () => {
  it('formats month label and computes VN UTC bounds', () => {
    expect(formatMonthLabel('2026-11')).toBe('Tháng 11/2026');
    expect(currentVnMonth(Date.UTC(2026, 10, 30, 18, 0, 0))).toBe('2026-12');
    const { start, end } = monthBoundsUtc('2026-11');
    expect(start.toISOString()).toBe('2026-10-31T17:00:00.000Z');
    expect(end.toISOString()).toBe('2026-11-30T16:59:59.999Z');
  });

  it('validates target figures', () => {
    const valid = upsertSalesTargetInput.safeParse({
      month: '2026-11',
      visitCountTarget: '40',
      dealerCoverageTarget: '25',
      salesKgTarget: '1500',
      note: '',
    });
    expect(valid.success).toBe(true);

    const bad = upsertSalesTargetInput.safeParse({
      month: '2026-13',
      visitCountTarget: 0,
      dealerCoverageTarget: 10,
      salesKgTarget: 0,
      note: '',
    });
    expect(bad.success).toBe(false);
  });

  it('allows only this month and next month (VN time)', () => {
    // 31/12/2026 20:00 UTC = 01/01/2027 03:00 gio VN.
    const now = Date.UTC(2026, 11, 31, 20, 0, 0);
    expect(editableTargetMonths(now)).toEqual(['2027-01', '2027-02']);
    expect(isEditableTargetMonth('2026-12', now)).toBe(false);
    expect(isEditableTargetMonth('2027-02', now)).toBe(true);
    expect(isEditableTargetMonth('2027-03', now)).toBe(false);
  });
});
