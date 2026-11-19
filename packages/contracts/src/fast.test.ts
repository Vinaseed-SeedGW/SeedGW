import { describe, expect, it } from 'vitest';
import {
  FastApiError,
  fastCustomerActive,
  fastGetCustomers,
  fastLogin,
  formatFastDateTime,
  parseFastDateTime,
} from './fast';

const config = {
  baseUrl: 'https://fast.test/api/',
  username: 'seedgw',
  password: 'x',
  enabled: true,
};

function fakeFetch(handler: (url: string, init: RequestInit) => { status: number; body: unknown }) {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    const { status, body } = handler(String(url), init ?? {});
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
}

describe('ngày giờ FAST', () => {
  it('ghi và đọc theo giờ Việt Nam', () => {
    const at = new Date('2026-11-19T02:30:05Z');
    expect(formatFastDateTime(at)).toBe('2026-11-19 09:30:05');
    expect(parseFastDateTime('2026-11-19 09:30:05')?.toISOString()).toBe(
      '2026-11-19T02:30:05.000Z',
    );
    expect(parseFastDateTime('2023-02-24T14:47:31.517')?.toISOString()).toBe(
      '2023-02-24T07:47:31.000Z',
    );
    expect(parseFastDateTime('2023-02-24')?.toISOString()).toBe('2023-02-23T17:00:00.000Z');
    expect(parseFastDateTime('20230224')).toBeNull();
  });
});

describe('gọi API FAST', () => {
  it('đăng nhập lấy token, sai mật khẩu báo lỗi rõ', async () => {
    const ok = fakeFetch(() => ({ status: 200, body: { Success: true, Token: 'abc' } }));
    expect(await fastLogin(config, ok)).toBe('abc');
    const denied = fakeFetch(() => ({ status: 200, body: { Success: false } }));
    await expect(fastLogin(config, denied)).rejects.toBeInstanceOf(FastApiError);
  });

  it('lấy khách hàng theo mốc sửa, giữ dòng hợp lệ, tách dòng lỗi', async () => {
    let calledUrl = '';
    const fetchImpl = fakeFetch((url) => {
      calledUrl = url;
      return {
        status: 200,
        body: {
          customers: [
            {
              ma_kh: 'KH001',
              ten_kh: 'Đại lý A',
              dien_thoai: '0912 345 678',
              status: '1',
              ngay_sua: '2026-11-19 09:00:00',
            },
            { ma_kh: 1002, ten_kh: 'Đại lý B', status: 0 },
            { ten_kh: 'Thiếu mã' },
          ],
        },
      };
    });
    const page = await fastGetCustomers(config, 'abc', new Date('2026-11-19T02:00:00Z'), fetchImpl);
    expect(calledUrl).toBe('https://fast.test/api/customers?ngay_sua_tu=2026-11-19+09%3A00%3A00');
    expect(page.records.map((record) => record.ma_kh)).toEqual(['KH001', '1002']);
    expect(page.records[1]?.status).toBe('0');
    expect(page.invalid).toHaveLength(1);
  });

  it('trạng thái 0 là ngừng, còn lại là đang dùng', () => {
    expect(fastCustomerActive('0')).toBe(false);
    expect(fastCustomerActive('1')).toBe(true);
    expect(fastCustomerActive(null)).toBe(true);
  });
});
