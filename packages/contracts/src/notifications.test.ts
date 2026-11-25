import { describe, expect, it } from 'vitest';
import { notificationWebHref, readPushTarget } from './notifications';

const MANAGER = new Set(['support.request.manage', 'sales.approval.read', 'sales.route.read']);
const STAFF = new Set(['sales.route.read', 'sales.check-in.read']);

describe('readPushTarget', () => {
  it('đọc màn đích đúng dạng', () => {
    expect(readPushTarget({ target: { screen: 'support', code: 'HT-2026-00001' } })).toEqual({
      screen: 'support',
      code: 'HT-2026-00001',
    });
  });

  it('dữ liệu sai dạng thì không có đích', () => {
    expect(readPushTarget({ target: { screen: 'khong-co' } })).toBeNull();
    expect(readPushTarget(null)).toBeNull();
  });
});

describe('notificationWebHref', () => {
  it('quản trị mở được yêu cầu hỗ trợ trên web', () => {
    expect(notificationWebHref({ screen: 'support', code: 'HT-2026-00001' }, MANAGER)).toBe(
      '/quan-tri/ho-tro/HT-2026-00001',
    );
  });

  it('nhân viên không có trang hỗ trợ trên web thì không có đường dẫn', () => {
    expect(notificationWebHref({ screen: 'support', code: 'HT-2026-00001' }, STAFF)).toBeNull();
  });

  it('nhắc check-in mở trang Check-in khi có quyền xem', () => {
    expect(notificationWebHref({ screen: 'today' }, STAFF)).toBe('/kinh-doanh/check-in');
  });
});
