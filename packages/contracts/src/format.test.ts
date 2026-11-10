import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatDateOnly,
  formatDateTime,
  formatVnd,
  isoDateToDisplay,
  maskDateText,
  vietnamDayStart,
  vietnamNextDayStart,
} from './format';

describe('isoDateToDisplay', () => {
  it('doi sang ngay thang nam', () => {
    expect(isoDateToDisplay('2026-11-09')).toBe('09/11/2026');
  });

  it('giu nguyen chu dang go do', () => {
    expect(isoDateToDisplay('09/1')).toBe('09/1');
    expect(isoDateToDisplay('')).toBe('');
  });
});

describe('maskDateText', () => {
  it('tu chen dau gach cheo khi go so', () => {
    expect(maskDateText('0')).toBe('0');
    expect(maskDateText('09')).toBe('09');
    expect(maskDateText('091')).toBe('09/1');
    expect(maskDateText('09112026')).toBe('09/11/2026');
  });

  it('them so 0 khi nguoi dung tu go dau gach cheo', () => {
    expect(maskDateText('1/')).toBe('01');
    expect(maskDateText('01/2/')).toBe('01/02');
  });

  it('cat phan thua va bo chu', () => {
    expect(maskDateText('09/11/20261')).toBe('09/11/2026');
    expect(maskDateText('ab09')).toBe('09');
  });

  it('nhan ngay dan vao dang nam thang ngay', () => {
    expect(maskDateText('2026-11-09')).toBe('09/11/2026');
  });
});

describe('moc ngay theo gio Viet Nam', () => {
  it('dau ngay lui 7 gio so voi UTC', () => {
    expect(vietnamDayStart('2026-11-10').toISOString()).toBe('2026-11-09T17:00:00.000Z');
  });

  it('dau ngay ke tiep cach dung mot ngay', () => {
    expect(vietnamNextDayStart('2026-11-10').toISOString()).toBe('2026-11-10T17:00:00.000Z');
  });
});

describe('formatDateTime', () => {
  it('hien ngay gio theo gio Viet Nam', () => {
    expect(formatDateTime('2026-11-08T18:05:00.000Z')).toBe('09/11/2026 01:05');
  });
});

describe('formatVnd', () => {
  it('ngan cach hang nghin bang dau cham va dung chu d', () => {
    expect(formatVnd(48750000)).toBe('48.750.000 đ');
  });

  it('chi dung ky tu co trong font', () => {
    expect(formatVnd(1000)).not.toMatch(/[₫ ]/u);
  });
});

describe('formatDate', () => {
  it('hien theo gio Viet Nam', () => {
    expect(formatDate('2026-11-08T18:00:00.000Z')).toBe('09/11/2026');
  });
});

describe('formatDateOnly', () => {
  it('giu nguyen ngay da nhap', () => {
    expect(formatDateOnly('2024-03-15')).toBe('15/03/2024');
  });

  it('tra null khi chua nhap ngay', () => {
    expect(formatDateOnly('')).toBeNull();
  });
});
