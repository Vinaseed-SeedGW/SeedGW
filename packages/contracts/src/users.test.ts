import { describe, expect, it } from 'vitest';
import { usersUrlParams } from './users';

describe('usersUrlParams', () => {
  it('doc dung trang thai tu URL', () => {
    expect(
      usersUrlParams.parse({
        q: 'nguyen',
        trang: '3',
        'trang-thai': 'LOCKED',
        'sap-xep': '-fullName',
      }),
    ).toEqual({ q: 'nguyen', status: 'LOCKED', sort: '-fullName', page: 3, pageSize: 20 });
  });

  it('dung mac dinh khi thieu tham so', () => {
    expect(usersUrlParams.parse({})).toEqual({
      q: undefined,
      status: undefined,
      sort: 'employeeCode',
      page: 1,
      pageSize: 20,
    });
  });

  it('bo qua gia tri sai thay vi bao loi', () => {
    expect(
      usersUrlParams.parse({
        q: ['a', 'b'],
        trang: '-1',
        'trang-thai': 'X',
        'sap-xep': 'password',
      }),
    ).toEqual({ q: undefined, status: undefined, sort: 'employeeCode', page: 1, pageSize: 20 });
  });

  it('khong nhan so trang qua lon', () => {
    expect(usersUrlParams.parse({ trang: '99999999999' }).page).toBe(1);
  });
});
