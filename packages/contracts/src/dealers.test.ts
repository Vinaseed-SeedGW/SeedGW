import { describe, expect, it } from 'vitest';
import {
  dealersUrlParams,
  normalizeVnPhone,
  parseLegacyDealerCode,
  updateDealerInput,
} from './dealers';
import { PROVINCES, toNewProvince } from './provinces';

// 63 tỉnh cũ đúng cách viết trong file xuất từ hệ thống cũ ngày 13/11/2026.
const OLD_PROVINCES = [
  'Thành phố Cần Thơ',
  'Thành phố Hà Nội',
  'Thành phố Hải Phòng',
  'Thành phố Hồ Chí Minh',
  'Thành phố Đà Nẵng',
  'Tỉnh An Giang',
  'Tỉnh Bà Rịa - Vũng Tàu',
  'Tỉnh Bình Dương',
  'Tỉnh Bình Phước',
  'Tỉnh Bình Thuận',
  'Tỉnh Bình Định',
  'Tỉnh Bạc Liêu',
  'Tỉnh Bắc Giang',
  'Tỉnh Bắc Kạn',
  'Tỉnh Bắc Ninh',
  'Tỉnh Bến Tre',
  'Tỉnh Cao Bằng',
  'Tỉnh Cà Mau',
  'Tỉnh Gia Lai',
  'Tỉnh Hoà Bình',
  'Tỉnh Hà Giang',
  'Tỉnh Hà Nam',
  'Tỉnh Hà Tĩnh',
  'Tỉnh Hưng Yên',
  'Tỉnh Hải Dương',
  'Tỉnh Hậu Giang',
  'Tỉnh Khánh Hòa',
  'Tỉnh Kiên Giang',
  'Tỉnh Kon Tum',
  'Tỉnh Lai Châu',
  'Tỉnh Long An',
  'Tỉnh Lào Cai',
  'Tỉnh Lâm Đồng',
  'Tỉnh Lạng Sơn',
  'Tỉnh Nam Định',
  'Tỉnh Nghệ An',
  'Tỉnh Ninh Bình',
  'Tỉnh Ninh Thuận',
  'Tỉnh Phú Thọ',
  'Tỉnh Phú Yên',
  'Tỉnh Quảng Bình',
  'Tỉnh Quảng Nam',
  'Tỉnh Quảng Ngãi',
  'Tỉnh Quảng Ninh',
  'Tỉnh Quảng Trị',
  'Tỉnh Sóc Trăng',
  'Tỉnh Sơn La',
  'Tỉnh Thanh Hóa',
  'Tỉnh Thái Bình',
  'Tỉnh Thái Nguyên',
  'Tỉnh Thừa Thiên Huế',
  'Tỉnh Tiền Giang',
  'Tỉnh Trà Vinh',
  'Tỉnh Tuyên Quang',
  'Tỉnh Tây Ninh',
  'Tỉnh Vĩnh Long',
  'Tỉnh Vĩnh Phúc',
  'Tỉnh Yên Bái',
  'Tỉnh Điện Biên',
  'Tỉnh Đắk Lắk',
  'Tỉnh Đắk Nông',
  'Tỉnh Đồng Nai',
  'Tỉnh Đồng Tháp',
];

describe('toNewProvince', () => {
  it('đổi được đủ 63 tỉnh cũ, ra đúng 34 tỉnh mới', () => {
    expect(OLD_PROVINCES).toHaveLength(63);
    const results = OLD_PROVINCES.map(toNewProvince);
    expect(results.every((name) => name !== null)).toBe(true);
    expect(new Set(results).size).toBe(34);
    expect(new Set(PROVINCES).size).toBe(34);
  });

  it('gộp tỉnh theo Nghị quyết 202/2025/QH15', () => {
    expect(toNewProvince('Tỉnh Hải Dương')).toBe('Thành phố Hải Phòng');
    expect(toNewProvince('Tỉnh Hà Nam')).toBe('Tỉnh Ninh Bình');
    expect(toNewProvince('Tỉnh Thái Bình')).toBe('Tỉnh Hưng Yên');
    expect(toNewProvince('Tỉnh Bình Định')).toBe('Tỉnh Gia Lai');
    expect(toNewProvince('Tỉnh Thừa Thiên Huế')).toBe('Thành phố Huế');
  });

  it('nhận tên tỉnh mới và cách viết khác', () => {
    expect(toNewProvince('Thành phố Huế')).toBe('Thành phố Huế');
    expect(toNewProvince('Thanh Hoá')).toBe('Tỉnh Thanh Hóa');
    expect(toNewProvince('TP Hồ Chí Minh')).toBe('Thành phố Hồ Chí Minh');
    expect(toNewProvince('')).toBeNull();
    expect(toNewProvince('Không rõ')).toBeNull();
  });
});

describe('parseLegacyDealerCode', () => {
  it('lấy tiền tố đơn vị và cấp đại lý', () => {
    expect(parseLegacyDealerCode('VR02.C2.0083418')).toEqual({ unitPrefix: 'VR02', level: 2 });
    expect(parseLegacyDealerCode('Vinarice.C3.0000012')).toEqual({
      unitPrefix: 'VINARICE',
      level: 3,
    });
    expect(parseLegacyDealerCode('VR02.C4.1')).toBeNull();
    expect(parseLegacyDealerCode('QS01TUTP0032')).toBeNull();
  });
});

describe('normalizeVnPhone', () => {
  it('chuẩn hoá về 10 số', () => {
    expect(normalizeVnPhone('0388 095 365')).toBe('0388095365');
    expect(normalizeVnPhone('+84388095365')).toBe('0388095365');
    expect(normalizeVnPhone('84388095365')).toBe('0388095365');
    expect(normalizeVnPhone('0388.095.365')).toBe('0388095365');
  });

  it('trả null cho số sai', () => {
    expect(normalizeVnPhone('0')).toBeNull();
    expect(normalizeVnPhone('03355697534')).toBeNull();
    expect(normalizeVnPhone('abc')).toBeNull();
  });
});

describe('updateDealerInput', () => {
  const base = {
    id: '6f1c1d2e-3a4b-4c5d-8e9f-0a1b2c3d4e5f',
    level: 2,
    status: 'ACTIVE',
    parentCode: '',
    phone: '0388 095 365',
    ownerName: '',
    ownerPhone: '',
    address: 'Thị trấn Thanh Miện',
    provinceName: 'Thành phố Hải Phòng',
    lat: null,
    lng: null,
    orgUnitId: '7f1c1d2e-3a4b-4c5d-8e9f-0a1b2c3d4e5f',
    assignedUserId: null,
  };

  it('chuẩn hoá số điện thoại, ô trống thành null', () => {
    const parsed = updateDealerInput.parse(base);
    expect(parsed.phone).toBe('0388095365');
    expect(parsed.ownerName).toBeNull();
    expect(parsed.ownerPhone).toBeNull();
  });

  it('báo lỗi khi chỉ có một trong hai toạ độ hoặc số điện thoại sai', () => {
    expect(updateDealerInput.safeParse({ ...base, lat: 21 }).success).toBe(false);
    expect(updateDealerInput.safeParse({ ...base, phone: '0' }).success).toBe(false);
  });
});

describe('dealersUrlParams', () => {
  it('đọc tham số tiếng Việt, giá trị sai thì dùng mặc định', () => {
    const input = dealersUrlParams.parse({
      cap: '2',
      'trang-thai': 'ngung-hoat-dong',
      'nhan-vien': 'chua-gan',
      'toa-do': 'chua-co',
      trang: 'abc',
    });
    expect(input).toMatchObject({
      level: 2,
      status: 'INACTIVE',
      unassignedOnly: true,
      missingLocationOnly: true,
      page: 1,
      sort: 'name',
    });
    expect(dealersUrlParams.parse({ cap: '9' }).level).toBeUndefined();
  });
});
