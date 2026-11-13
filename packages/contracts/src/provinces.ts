import { normalizeSearchText } from './text';

// 34 tỉnh, thành phố sau sắp xếp đơn vị hành chính có hiệu lực từ 01/07/2025 (Nghị quyết 202/2025/QH15).
// Dữ liệu DMS cũ còn dùng 63 tỉnh, nên khi nhập đại lý đổi tên tỉnh cũ sang tỉnh mới theo bảng dưới.
export const PROVINCES = [
  'Thành phố Hà Nội',
  'Thành phố Huế',
  'Thành phố Hải Phòng',
  'Thành phố Đà Nẵng',
  'Thành phố Hồ Chí Minh',
  'Thành phố Cần Thơ',
  'Tỉnh Lai Châu',
  'Tỉnh Điện Biên',
  'Tỉnh Sơn La',
  'Tỉnh Lạng Sơn',
  'Tỉnh Quảng Ninh',
  'Tỉnh Thanh Hóa',
  'Tỉnh Nghệ An',
  'Tỉnh Hà Tĩnh',
  'Tỉnh Cao Bằng',
  'Tỉnh Tuyên Quang',
  'Tỉnh Lào Cai',
  'Tỉnh Thái Nguyên',
  'Tỉnh Phú Thọ',
  'Tỉnh Bắc Ninh',
  'Tỉnh Hưng Yên',
  'Tỉnh Ninh Bình',
  'Tỉnh Quảng Trị',
  'Tỉnh Quảng Ngãi',
  'Tỉnh Gia Lai',
  'Tỉnh Khánh Hòa',
  'Tỉnh Lâm Đồng',
  'Tỉnh Đắk Lắk',
  'Tỉnh Đồng Nai',
  'Tỉnh Tây Ninh',
  'Tỉnh Vĩnh Long',
  'Tỉnh Đồng Tháp',
  'Tỉnh Cà Mau',
  'Tỉnh An Giang',
] as const;
export type ProvinceName = (typeof PROVINCES)[number];

// Tỉnh cũ (bỏ chữ "Tỉnh", "Thành phố") sang tỉnh mới. Tỉnh không sáp nhập thì giữ tên.
const OLD_TO_NEW: Record<string, ProvinceName> = {
  'ha noi': 'Thành phố Hà Nội',
  'thua thien hue': 'Thành phố Huế',
  hue: 'Thành phố Huế',
  'hai phong': 'Thành phố Hải Phòng',
  'hai duong': 'Thành phố Hải Phòng',
  'da nang': 'Thành phố Đà Nẵng',
  'quang nam': 'Thành phố Đà Nẵng',
  'ho chi minh': 'Thành phố Hồ Chí Minh',
  'binh duong': 'Thành phố Hồ Chí Minh',
  'ba ria - vung tau': 'Thành phố Hồ Chí Minh',
  'ba ria vung tau': 'Thành phố Hồ Chí Minh',
  'can tho': 'Thành phố Cần Thơ',
  'soc trang': 'Thành phố Cần Thơ',
  'hau giang': 'Thành phố Cần Thơ',
  'lai chau': 'Tỉnh Lai Châu',
  'dien bien': 'Tỉnh Điện Biên',
  'son la': 'Tỉnh Sơn La',
  'lang son': 'Tỉnh Lạng Sơn',
  'quang ninh': 'Tỉnh Quảng Ninh',
  'thanh hoa': 'Tỉnh Thanh Hóa',
  'nghe an': 'Tỉnh Nghệ An',
  'ha tinh': 'Tỉnh Hà Tĩnh',
  'cao bang': 'Tỉnh Cao Bằng',
  'tuyen quang': 'Tỉnh Tuyên Quang',
  'ha giang': 'Tỉnh Tuyên Quang',
  'lao cai': 'Tỉnh Lào Cai',
  'yen bai': 'Tỉnh Lào Cai',
  'thai nguyen': 'Tỉnh Thái Nguyên',
  'bac kan': 'Tỉnh Thái Nguyên',
  'phu tho': 'Tỉnh Phú Thọ',
  'vinh phuc': 'Tỉnh Phú Thọ',
  'hoa binh': 'Tỉnh Phú Thọ',
  'bac ninh': 'Tỉnh Bắc Ninh',
  'bac giang': 'Tỉnh Bắc Ninh',
  'hung yen': 'Tỉnh Hưng Yên',
  'thai binh': 'Tỉnh Hưng Yên',
  'ninh binh': 'Tỉnh Ninh Bình',
  'ha nam': 'Tỉnh Ninh Bình',
  'nam dinh': 'Tỉnh Ninh Bình',
  'quang tri': 'Tỉnh Quảng Trị',
  'quang binh': 'Tỉnh Quảng Trị',
  'quang ngai': 'Tỉnh Quảng Ngãi',
  'kon tum': 'Tỉnh Quảng Ngãi',
  'gia lai': 'Tỉnh Gia Lai',
  'binh dinh': 'Tỉnh Gia Lai',
  'khanh hoa': 'Tỉnh Khánh Hòa',
  'ninh thuan': 'Tỉnh Khánh Hòa',
  'lam dong': 'Tỉnh Lâm Đồng',
  'dak nong': 'Tỉnh Lâm Đồng',
  'binh thuan': 'Tỉnh Lâm Đồng',
  'dak lak': 'Tỉnh Đắk Lắk',
  'phu yen': 'Tỉnh Đắk Lắk',
  'dong nai': 'Tỉnh Đồng Nai',
  'binh phuoc': 'Tỉnh Đồng Nai',
  'tay ninh': 'Tỉnh Tây Ninh',
  'long an': 'Tỉnh Tây Ninh',
  'vinh long': 'Tỉnh Vĩnh Long',
  'ben tre': 'Tỉnh Vĩnh Long',
  'tra vinh': 'Tỉnh Vĩnh Long',
  'dong thap': 'Tỉnh Đồng Tháp',
  'tien giang': 'Tỉnh Đồng Tháp',
  'ca mau': 'Tỉnh Cà Mau',
  'bac lieu': 'Tỉnh Cà Mau',
  'an giang': 'Tỉnh An Giang',
  'kien giang': 'Tỉnh An Giang',
};

function provinceKey(name: string): string {
  return normalizeSearchText(name)
    .replace(/^(tinh|thanh pho|tp\.?)\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Đổi tên tỉnh cũ hoặc mới ra tên tỉnh mới. Không nhận ra thì trả null. */
export function toNewProvince(name: string): ProvinceName | null {
  if (!name.trim()) return null;
  return OLD_TO_NEW[provinceKey(name)] ?? null;
}
