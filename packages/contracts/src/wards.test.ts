import { describe, expect, it } from 'vitest';
import { PROVINCES } from './provinces';
import { isWardOf, WARDS } from './wards';

describe('WARDS (xã, phường từ 01/07/2025)', () => {
  it('đủ 34 tỉnh và 3.321 đơn vị cấp xã', () => {
    expect(Object.keys(WARDS)).toEqual([...PROVINCES]);
    const total = PROVINCES.reduce((sum, province) => sum + WARDS[province].length, 0);
    expect(total).toBe(3321);
  });

  it('tên đã chuẩn hoá: đúng loại đơn vị, dấu NFC, không trùng trong tỉnh', () => {
    for (const province of PROVINCES) {
      const list = WARDS[province];
      expect(new Set(list).size).toBe(list.length);
      for (const ward of list) {
        expect(ward).toMatch(/^(Xã|Phường|Đặc khu) \S/);
        expect(ward).toBe(ward.normalize('NFC'));
        expect(ward).toBe(ward.trim());
      }
    }
  });

  it('kiểm xã thuộc tỉnh', () => {
    expect(isWardOf('Thành phố Hà Nội', 'Phường Ba Đình')).toBe(true);
    expect(isWardOf('Tỉnh Thanh Hóa', 'Phường Ba Đình')).toBe(false);
  });
});
