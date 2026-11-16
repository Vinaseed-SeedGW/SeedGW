import { describe, expect, it } from 'vitest';
import { dealerLocationUrlParams, isSameStreet, streetOf } from './dealer-locations';

describe('streetOf', () => {
  it('lấy tên phố sau số nhà, ngõ', () => {
    expect(streetOf('135 Phương Mai, Phường Kim Liên, Thành phố Hà Nội')).toBe('phuong mai');
    expect(streetOf('34/22 Hoàng Cầu, Phường Ô Chợ Dừa')).toBe('hoang cau');
    expect(streetOf('Gần 21 Lê Văn Thiêm, Phường Thanh Xuân')).toBe('le van thiem');
    expect(streetOf('Ngõ 34 Phố Hoàng Cầu, Phường Ô Chợ Dừa')).toBe('hoang cau');
  });

  it('bỏ qua địa chỉ không có số nhà hoặc ngõ', () => {
    expect(streetOf('Thôn Đông, Xã Yên Thủy, Tỉnh Phú Thọ')).toBeNull();
    expect(streetOf('')).toBeNull();
  });
});

describe('isSameStreet', () => {
  it('khớp 5 đại lý trong chuyến đi thử 16/11', () => {
    const pairs: [string, string][] = [
      ['135 Phương Mai, Phường Kim Liên', '137 Phương Mai, P. Phương Mai, Q. Đống Đa'],
      ['274 Chợ Khâm Thiên, Phường Văn Miếu', '249 Chợ Khâm Thiên, P. Phương Liên, Q. Đống Đa'],
      ['81 An Trạch, Phường Ô Chợ Dừa', '72, Phố An Trạch, Phường Cát Linh, Quận Đống Đa'],
      ['34/22 Hoàng Cầu, Phường Ô Chợ Dừa', '34Ngõ 34 Phố Hoàng Cầu, Phường Ô Chợ Dừa'],
      ['4 Hoàng Ngọc Phách, Phường Láng', '6 Hoàng Ngọc Phách, P. Láng Hạ, Q. Đống Đa'],
    ];
    for (const [checkIn, dealer] of pairs) expect(isSameStreet(checkIn, dealer)).toBe(true);
  });

  it('báo khác phố, không so khi thiếu thông tin', () => {
    expect(isSameStreet('12 Láng Hạ, Phường Láng', '6 Hoàng Ngọc Phách, Q. Đống Đa')).toBe(false);
    expect(isSameStreet('8 Mai Hắc Đế', 'Số 8 Hắc Đế')).toBe(false);
    expect(isSameStreet(null, '6 Hoàng Ngọc Phách')).toBeNull();
    expect(isSameStreet('Thôn Đông, Xã Yên Thủy', 'Thôn Đông')).toBeNull();
  });
});

describe('dealerLocationUrlParams', () => {
  it('mặc định tab chờ duyệt, trang 1', () => {
    expect(dealerLocationUrlParams.parse({})).toEqual({ tab: 'cho-duyet', page: 1, pageSize: 20 });
    expect(dealerLocationUrlParams.parse({ tab: 'x', trang: '-1' }).tab).toBe('cho-duyet');
    expect(dealerLocationUrlParams.parse({ tab: 'da-xu-ly', trang: '3' }).page).toBe(3);
  });
});
