import { describe, expect, it } from 'vitest';
import { departmentLanding } from './departments';

describe('departmentLanding', () => {
  it('dung trang dich mac dinh khi vai tro khong co trang rieng', () => {
    expect(departmentLanding('kinh-doanh', ['sales'])).toBe('/kinh-doanh/dashboard');
    expect(departmentLanding('quan-tri', ['operations'])).toBe('/quan-tri/tai-khoan');
  });

  it('dung trang dich theo vai tro', () => {
    expect(departmentLanding('kinh-doanh', ['sales', 'asm'])).toBe('/kinh-doanh/can-duyet');
    expect(departmentLanding('cskh', ['customer-care-lead'])).toBe('/cskh/phieu');
  });
});
