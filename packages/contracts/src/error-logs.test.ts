import { describe, expect, it } from 'vitest';
import { errorLogsUrlParams } from './error-logs';

describe('errorLogsUrlParams', () => {
  it('mặc định xem lỗi chưa xử lý, mọi nguồn', () => {
    expect(errorLogsUrlParams.parse({})).toEqual({
      source: undefined,
      resolved: false,
      page: 1,
      pageSize: 30,
    });
  });

  it('đọc nguồn và trạng thái trên URL', () => {
    const input = errorLogsUrlParams.parse({ nguon: 'app', 'trang-thai': 'da-xu-ly', trang: '2' });
    expect(input.source).toBe('MOBILE');
    expect(input.resolved).toBe(true);
    expect(input.page).toBe(2);
  });
});
