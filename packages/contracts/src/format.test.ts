import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime, formatVnd } from './format';

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
