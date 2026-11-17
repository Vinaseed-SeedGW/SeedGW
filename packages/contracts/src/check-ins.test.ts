import { describe, expect, it } from 'vitest';
import { checkInTabParam, dayMapUrlParams, mobileHistoryQuery } from './check-ins';

const NOW = new Date('2026-11-17T03:00:00Z');

describe('dayMapUrlParams', () => {
  it('đọc nhân viên, đơn vị, ngày dạng dd/mm/yyyy', () => {
    expect(dayMapUrlParams(NOW).parse({ 'nhan-vien': 'KD001', ngay: '16/11/2026' })).toEqual({
      employeeCode: 'KD001',
      orgUnitId: null,
      day: '2026-11-16',
    });
  });

  it('mặc định hôm nay, chặn ngày tương lai và quá 18 tháng', () => {
    expect(dayMapUrlParams(NOW).parse({}).day).toBe('2026-11-17');
    expect(dayMapUrlParams(NOW).parse({ ngay: '20/11/2026' }).day).toBe('2026-11-17');
    expect(dayMapUrlParams(NOW).parse({ ngay: '01/01/2020' }).day).toBe('2025-05-17');
    expect(dayMapUrlParams(NOW).parse({ 'don-vi': 'khong-phai-uuid' }).orgUnitId).toBeNull();
  });
});

describe('checkInTabParam', () => {
  it('mặc định tab Danh sách', () => {
    expect(checkInTabParam.parse({}).tab).toBe('danh-sach');
    expect(checkInTabParam.parse({ tab: 'ban-do' }).tab).toBe('ban-do');
    expect(checkInTabParam.parse({ tab: 'xyz' }).tab).toBe('danh-sach');
  });
});

describe('mobileHistoryQuery', () => {
  it('chỉ nhận tháng yyyy-MM hợp lệ', () => {
    expect(mobileHistoryQuery.safeParse({ month: '2026-11' }).success).toBe(true);
    expect(mobileHistoryQuery.safeParse({ month: '2026-13' }).success).toBe(false);
    expect(mobileHistoryQuery.safeParse({ month: '11/2026' }).success).toBe(false);
  });
});
