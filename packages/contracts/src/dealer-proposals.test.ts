import { describe, expect, it } from 'vitest';
import { createCheckInInput } from './check-ins';
import {
  approveDealerProposalInput,
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
