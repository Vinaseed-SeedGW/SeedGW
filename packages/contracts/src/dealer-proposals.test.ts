import { describe, expect, it } from 'vitest';
import { createCheckInInput } from './check-ins';
import {
  addressWithWard,
  approveDealerProposalInput,
  createDealerWebInput,
  newDealerInput,
  normalizeTaxCode,
  rejectDealerProposalInput,
} from './dealer-proposals';

const CHECK_IN = {
  clientId: '7f1e7f0a-3c55-4f2a-9a43-5c1a8d2f3b10',
  capturedAt: '2026-11-20T03:00:00.000Z',
  lat: 21.0,
  lng: 105.8,
  accuracyM: 8,
  isMocked: false,
  placeKind: 'OTHER',
  placeName: 'Cửa hàng mới',
  note: 'Đề xuất đại lý mới',
};

const NEW_DEALER = { name: 'Cửa hàng mới', phone: '+84 912 345 678', address: '12 Phố Huế' };

describe('normalizeTaxCode', () => {
  it('nhận 10 số và 10 số kèm chi nhánh', () => {
    expect(normalizeTaxCode('0101234567')).toBe('0101234567');
    expect(normalizeTaxCode('0101234567-001')).toBe('0101234567-001');
    expect(normalizeTaxCode('0101234567001')).toBe('0101234567-001');
    expect(normalizeTaxCode('0101 234 567')).toBe('0101234567');
  });

  it('từ chối số sai độ dài', () => {
    expect(normalizeTaxCode('12345')).toBeNull();
    expect(normalizeTaxCode('0101234567-01')).toBeNull();
  });
});

describe('newDealerInput', () => {
  it('chuẩn hoá số điện thoại, mặc định cấp 3, trường trống thành null', () => {
    const parsed = newDealerInput.parse({ ...NEW_DEALER, ownerName: '  ', taxCode: '' });
    expect(parsed).toEqual({
      name: 'Cửa hàng mới',
      phone: '0912345678',
      address: '12 Phố Huế',
      ownerName: null,
      taxCode: null,
      level: 3,
    });
  });

  it('bắt buộc tên, số điện thoại đúng dạng, địa chỉ', () => {
    expect(newDealerInput.safeParse({ ...NEW_DEALER, name: ' ' }).success).toBe(false);
    expect(newDealerInput.safeParse({ ...NEW_DEALER, phone: '12345' }).success).toBe(false);
    expect(newDealerInput.safeParse({ ...NEW_DEALER, address: '' }).success).toBe(false);
    expect(newDealerInput.safeParse({ ...NEW_DEALER, taxCode: '999' }).success).toBe(false);
  });
});

describe('createCheckInInput với đề xuất đại lý mới', () => {
  it('nhận đề xuất kèm check-in Điểm khác', () => {
    const parsed = createCheckInInput.parse({ ...CHECK_IN, newDealer: NEW_DEALER });
    expect(parsed.newDealer?.phone).toBe('0912345678');
  });

  it('đề xuất sai vẫn lưu check-in, bỏ phần đề xuất', () => {
    const parsed = createCheckInInput.parse({
      ...CHECK_IN,
      newDealer: { ...NEW_DEALER, phone: 'abc' },
    });
    expect(parsed.clientId).toBe(CHECK_IN.clientId);
    expect(parsed.newDealer).toBeNull();
  });

  it('bỏ đề xuất khi check-in không phải Điểm khác', () => {
    const parsed = createCheckInInput.parse({
      ...CHECK_IN,
      placeKind: 'CUSTOMER',
      newDealer: NEW_DEALER,
    });
    expect(parsed.newDealer).toBeNull();
  });

  it('app cũ không gửi đề xuất', () => {
    expect(createCheckInInput.parse(CHECK_IN).newDealer).toBeNull();
  });
});

describe('duyệt và từ chối', () => {
  it('duyệt cần đơn vị, cấp đọc từ ô chọn', () => {
    const base = {
      id: '7f1e7f0a-3c55-4f2a-9a43-5c1a8d2f3b10',
      ...NEW_DEALER,
      ownerName: '',
      taxCode: '',
      level: '2',
      provinceName: null,
      assignedUserId: null,
    };
    expect(approveDealerProposalInput.safeParse({ ...base, orgUnitId: null }).success).toBe(false);
    const parsed = approveDealerProposalInput.parse({
      ...base,
      orgUnitId: '1b4e28ba-2fa1-41d2-883f-0016d3cca427',
    });
    expect(parsed.level).toBe(2);
  });

  it('lý do từ chối từ 5 tới 500 ký tự', () => {
    const id = '7f1e7f0a-3c55-4f2a-9a43-5c1a8d2f3b10';
    expect(rejectDealerProposalInput.safeParse({ id, note: 'trùng' }).success).toBe(true);
    expect(rejectDealerProposalInput.safeParse({ id, note: 'sai' }).success).toBe(false);
    expect(rejectDealerProposalInput.safeParse({ id, note: 'x'.repeat(501) }).success).toBe(false);
  });
});

describe('createDealerWebInput (thêm đại lý trên web)', () => {
  const BASE = {
    name: ' Đại lý Minh Phát ',
    phone: '0912 345 678',
    address: 'Thôn 3, xã Tân Lập',
    ownerName: '',
    taxCode: '',
    level: '3',
    provinceName: 'Thành phố Hà Nội',
    lat: '',
    lng: '',
    orgUnitId: '',
    assignedUserId: null,
  };

  it('không bắt buộc toạ độ, đơn vị; ô trống thành null, cấp đọc từ ô chọn', () => {
    const parsed = createDealerWebInput.parse(BASE);
    expect(parsed).toMatchObject({
      name: 'Đại lý Minh Phát',
      phone: '0912345678',
      ownerName: null,
      taxCode: null,
      level: 3,
      lat: null,
      lng: null,
      orgUnitId: null,
      assignedUserId: null,
    });
  });

  it('nhận toạ độ dấu phẩy, bắt nhập đủ cả hai', () => {
    expect(createDealerWebInput.parse({ ...BASE, lat: '21,0285', lng: '105,8542' })).toMatchObject({
      lat: 21.0285,
      lng: 105.8542,
    });
    const half = createDealerWebInput.safeParse({ ...BASE, lat: '21.0285' });
    expect(half.success).toBe(false);
    expect(half.error?.issues[0]?.path).toEqual(['lat']);
  });

  it('bắt buộc tên, số điện thoại đúng dạng, địa chỉ; mã số thuế đúng dạng', () => {
    expect(createDealerWebInput.safeParse({ ...BASE, name: ' ' }).success).toBe(false);
    expect(createDealerWebInput.safeParse({ ...BASE, phone: '12345' }).success).toBe(false);
    expect(createDealerWebInput.safeParse({ ...BASE, address: '' }).success).toBe(false);
    expect(createDealerWebInput.safeParse({ ...BASE, taxCode: '123' }).success).toBe(false);
    expect(createDealerWebInput.parse({ ...BASE, taxCode: '0101234567' }).taxCode).toBe(
      '0101234567',
    );
  });

  it('đơn vị phải là mã hợp lệ khi Quản trị chọn', () => {
    expect(createDealerWebInput.safeParse({ ...BASE, orgUnitId: 'abc' }).success).toBe(false);
    const unit = '7f1e7f0a-3c55-4f2a-9a43-5c1a8d2f3b10';
    expect(createDealerWebInput.parse({ ...BASE, orgUnitId: unit }).orgUnitId).toBe(unit);
  });

  it('bắt buộc chọn tỉnh; xã, phường không bắt buộc, ô trống thành null', () => {
    const noProvince = createDealerWebInput.safeParse({ ...BASE, provinceName: null });
    expect(noProvince.success).toBe(false);
    expect(noProvince.error?.issues[0]).toMatchObject({
      path: ['provinceName'],
      message: 'Chọn tỉnh, thành phố',
    });
    expect(createDealerWebInput.parse({ ...BASE, wardName: '' }).wardName).toBeNull();
    expect(createDealerWebInput.parse({ ...BASE, wardName: ' Phường Ba Đình ' }).wardName).toBe(
      'Phường Ba Đình',
    );
  });
});

describe('addressWithWard', () => {
  it('ghép xã, phường sau số nhà, thôn; không ghép lặp', () => {
    expect(addressWithWard('Số 5 Kim Mã', 'Phường Ba Đình')).toBe('Số 5 Kim Mã, Phường Ba Đình');
    expect(addressWithWard('Số 5 Kim Mã, phường Ba Đình', 'Phường Ba Đình')).toBe(
      'Số 5 Kim Mã, phường Ba Đình',
    );
    expect(addressWithWard('Thôn 3', null)).toBe('Thôn 3');
  });
});
