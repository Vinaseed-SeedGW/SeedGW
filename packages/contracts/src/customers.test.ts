import { describe, expect, it } from 'vitest';
import { createCheckInInput } from './check-ins';
import { createCustomerInput, customersUrlParams, formatAreaHa } from './customers';

const BASE = {
  kind: 'FARMER',
  name: 'Nguyễn Văn A',
  phone: '',
  provinceName: null,
  address: '',
  crops: [],
  areaHa: '',
  dealerIds: [],
  assignedUserId: null,
  note: '',
};

describe('createCustomerInput', () => {
  it('nhận diện tích có dấu phẩy và làm tròn 2 chữ số', () => {
    const parsed = createCustomerInput.parse({ ...BASE, areaHa: '1,256' });
    expect(parsed.areaHa).toBe(1.26);
  });

  it('ô diện tích trống là chưa biết', () => {
    expect(createCustomerInput.parse(BASE).areaHa).toBeNull();
  });

  it('từ chối diện tích âm', () => {
    expect(createCustomerInput.safeParse({ ...BASE, areaHa: '-1' }).success).toBe(false);
  });

  it('chuẩn hoá số điện thoại và bỏ cây trồng trùng, trống', () => {
    const parsed = createCustomerInput.parse({
      ...BASE,
      phone: '+84 912 345 678',
      crops: ['Lúa', 'Lúa', ' ', 'Ngô'],
    });
    expect(parsed.phone).toBe('0912345678');
    expect(parsed.crops).toEqual(['Lúa', 'Ngô']);
  });

  it('báo lỗi số điện thoại sai dạng', () => {
    expect(createCustomerInput.safeParse({ ...BASE, phone: '12345' }).success).toBe(false);
  });
});

describe('customersUrlParams', () => {
  it('đọc loại, tỉnh, cây trồng trên URL', () => {
    const input = customersUrlParams.parse({ loai: 'hop-tac-xa', tinh: 'ha-noi', cay: 'Lúa' });
    expect(input.kind).toBe('COOPERATIVE');
    expect(input.province).toBe('Thành phố Hà Nội');
    expect(input.crop).toBe('Lúa');
  });

  it('giá trị sai thì dùng mặc định', () => {
    const input = customersUrlParams.parse({ loai: 'abc', tinh: 'khong-co', trang: '-3' });
    expect(input.kind).toBeUndefined();
    expect(input.province).toBeUndefined();
    expect(input.page).toBe(1);
  });
});

describe('formatAreaHa', () => {
  it('hiện dấu phẩy thập phân', () => {
    expect(formatAreaHa(1.5)).toBe('1,5 ha');
  });
});

describe('createCheckInInput, khách hàng', () => {
  const CHECK_IN = {
    clientId: '6f1c2a1e-1b7f-4e8a-9d1e-0c2b3a4d5e6f',
    capturedAt: '2026-11-25T03:00:00.000Z',
    lat: 21,
    lng: 105,
    accuracyM: 10,
    isMocked: false,
    placeName: 'Nguyễn Văn A',
    note: 'Tư vấn giống',
    customerId: '1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d',
  };

  it('giữ khách hàng khi check-in loại Khách hàng', () => {
    const parsed = createCheckInInput.parse({ ...CHECK_IN, placeKind: 'CUSTOMER' });
    expect(parsed.customerId).toBe(CHECK_IN.customerId);
  });

  it('bỏ khách hàng khi check-in loại khác', () => {
    const parsed = createCheckInInput.parse({ ...CHECK_IN, placeKind: 'OTHER' });
    expect(parsed.customerId).toBeNull();
  });
});
