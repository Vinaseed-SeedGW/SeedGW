import { describe, expect, it } from 'vitest';
import { supportStatsUrlParams } from './support';

describe('supportStatsUrlParams', () => {
  const now = new Date('2026-11-25T03:00:00Z');
  it('mặc định 30 ngày gần nhất', () => {
    expect(supportStatsUrlParams(now).parse({})).toEqual({ from: '2026-10-27', to: '2026-11-25' });
  });
  it('Đến ngày trống tính tới hôm nay, nhập ngược thì đổi chỗ, không quá 366 ngày', () => {
    expect(supportStatsUrlParams(now).parse({ 'tu-ngay': '01/11/2026' })).toEqual({
      from: '2026-11-01',
      to: '2026-11-25',
    });
    expect(
      supportStatsUrlParams(now).parse({ 'tu-ngay': '20/11/2026', 'den-ngay': '10/11/2026' }),
    ).toEqual({ from: '2026-11-10', to: '2026-11-20' });
    expect(supportStatsUrlParams(now).parse({ 'tu-ngay': '01/01/2020' }).from).toBe('2025-11-25');
  });
});
