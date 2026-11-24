import { describe, expect, it } from 'vitest';
import { PROVINCES } from './provinces';
import {
  provinceFromSlug,
  provinceListInput,
  provinceSlug,
  selectedProvinces,
  shortProvinceName,
  suggestOrgUnit,
} from './regions';
import { guessProvinceFromAddress } from './provinces';
import { dealersUrlParams, userFitsUnit } from './dealers';

describe('vùng và tỉnh', () => {
  it('mỗi tỉnh có tham số URL riêng, đọc ngược lại được', () => {
    const slugs = PROVINCES.map(provinceSlug);
    expect(new Set(slugs).size).toBe(PROVINCES.length);
    expect(provinceSlug('Thành phố Hồ Chí Minh')).toBe('ho-chi-minh');
    expect(provinceSlug('Tỉnh Đắk Lắk')).toBe('dak-lak');
    for (const name of PROVINCES) expect(provinceFromSlug(provinceSlug(name))).toBe(name);
    expect(provinceFromSlug('tinh-cu')).toBeNull();
  });

  it('tên ngắn và danh sách tỉnh bỏ trùng theo thứ tự chuẩn', () => {
    expect(shortProvinceName('Tỉnh Gia Lai')).toBe('Gia Lai');
    expect(shortProvinceName('Thành phố Hà Nội')).toBe('TP Hà Nội');
    expect(provinceListInput.parse(['Tỉnh Gia Lai', 'Thành phố Hà Nội', 'Tỉnh Gia Lai'])).toEqual([
      'Thành phố Hà Nội',
      'Tỉnh Gia Lai',
    ]);
    expect(provinceListInput.safeParse(['Tỉnh Bình Định']).success).toBe(false);
  });

  it('tỉnh đang lọc theo tỉnh hoặc vùng', () => {
    const provinces = [
      { name: 'Thành phố Hà Nội', regionId: 'a' },
      { name: 'Tỉnh Ninh Bình', regionId: 'a' },
      { name: 'Tỉnh Gia Lai', regionId: 'b' },
    ] as const;
    expect(selectedProvinces({ regionId: null, provinceName: null }, provinces)).toBeNull();
    expect(selectedProvinces({ regionId: 'a', provinceName: null }, provinces)).toEqual([
      'Thành phố Hà Nội',
      'Tỉnh Ninh Bình',
    ]);
    expect(selectedProvinces({ regionId: 'a', provinceName: 'Tỉnh Ninh Bình' }, provinces)).toEqual(
      ['Tỉnh Ninh Bình'],
    );
  });

  it('K7b: gợi ý đơn vị, đoán tỉnh từ địa chỉ, nhân viên theo đơn vị, lọc danh sách', () => {
    expect(suggestOrgUnit(['a'], ['a', 'b'], 'c')).toBe('a');
    expect(suggestOrgUnit(['a', 'b'], ['a', 'b'], 'c')).toBe('c');
    expect(suggestOrgUnit(['x'], ['a'], 'c')).toBe('c');
    expect(suggestOrgUnit(undefined, ['a'], '')).toBe('');
    expect(guessProvinceFromAddress('12 Lê Lợi, Quy Nhơn, Bình Định')).toBe('Tỉnh Gia Lai');
    expect(guessProvinceFromAddress('Xã A, Huyện B, Thành phố Hà Nội')).toBe('Thành phố Hà Nội');
    expect(guessProvinceFromAddress('12 Phố Huế')).toBeNull();
    expect(userFitsUnit({ unitPath: ['con', 'cha'] }, 'cha')).toBe(true);
    expect(userFitsUnit({ unitPath: ['con', 'cha'] }, 'khac')).toBe(false);
    expect(userFitsUnit({ unitPath: ['con'] }, null)).toBe(false);
    expect(dealersUrlParams.parse({ tinh: 'gia-lai', 'dia-ban': 'ngoai' })).toMatchObject({
      province: 'Tỉnh Gia Lai',
      outsideArea: true,
    });
    expect(dealersUrlParams.parse({ tinh: 'chua-co' }).province).toBe('NONE');
    expect(dealersUrlParams.parse({ tinh: 'khong-co' }).province).toBeUndefined();
  });
});
