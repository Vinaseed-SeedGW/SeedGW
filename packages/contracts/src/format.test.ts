import { describe, expect, it } from 'vitest';
import { formatVnd } from './format';

describe('formatVnd', () => {
  it('ngan cach hang nghin bang dau cham va dung chu d', () => {
    expect(formatVnd(48750000)).toBe('48.750.000 đ');
  });

  it('chi dung ky tu co trong font', () => {
    expect(formatVnd(1000)).not.toMatch(/[₫ ]/u);
  });
});
