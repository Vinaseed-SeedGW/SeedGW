import { describe, expect, it } from 'vitest';
import { ratioPercent, reportUrlParams } from './reports';

describe('reportUrlParams', () => {
  const now = new Date('2026-11-23T03:00:00Z');

  it('mặc định theo nhân viên, trang 1, kỳ như Dashboard', () => {
    expect(reportUrlParams(now).parse({})).toMatchObject({
      group: 'nhan-vien',
      page: 1,
      period: 'thang-nay',
      from: '2026-11-01',
      to: '2026-11-23',
    });
  });

  it('đọc nhóm, trang, kỳ quý; giá trị sai về mặc định', () => {
    expect(reportUrlParams(now).parse({ theo: 'dai-ly', trang: '3', ky: 'quy-nay' })).toMatchObject(
      {
        group: 'dai-ly',
        page: 3,
        from: '2026-10-01',
      },
    );
    expect(reportUrlParams(now).parse({ theo: 'x', trang: '-1' })).toMatchObject({
      group: 'nhan-vien',
      page: 1,
    });
  });
});

describe('ratioPercent', () => {
  it('một số lẻ, mẫu bằng 0 thì không có', () => {
    expect(ratioPercent(1, 3)).toBe(33.3);
    expect(ratioPercent(5, 0)).toBeNull();
  });
});
