import { describe, expect, it } from 'vitest';
import {
  findManagerCycles,
  validateUserImportRows,
  type UserImportLookups,
  type UserImportRaw,
} from './user-import';

const LOOKUPS: UserImportLookups = {
  existingEmployeeCodes: new Set(['KD001']),
  orgUnitCodes: new Set(['VINASEED']),
  roleCodes: new Set(['sales', 'asm']),
  managerCodes: new Set(['KD001']),
};

function row(overrides: Partial<UserImportRaw> = {}): UserImportRaw {
  return {
    rowNumber: 2,
    employeeCode: 'nv100',
    fullName: 'Nguyễn Văn A',
    phone: '',
    email: '',
    orgUnitCode: 'vinaseed',
    jobTitle: '',
    hiredAt: '',
    managerCode: '',
    roleCodes: 'sales',
    password: 'Vinaseed2026',
    ...overrides,
  };
}

describe('validateUserImportRows', () => {
  it('chap nhan dong hop le va chuan hoa ma', () => {
    const [result] = validateUserImportRows(
      [row({ hiredAt: '09/11/2026', roleCodes: 'SALES; asm' })],
      LOOKUPS,
    );
    expect(result?.errors).toEqual([]);
    expect(result?.value).toMatchObject({
      employeeCode: 'NV100',
      orgUnitCode: 'VINASEED',
      hiredAt: '2026-11-09',
      roleCodes: ['sales', 'asm'],
    });
  });

  it('bao tung loi tren dong', () => {
    const [result] = validateUserImportRows(
      [row({ employeeCode: 'KD001', orgUnitCode: 'X', roleCodes: 'khong-co', managerCode: 'Y' })],
      LOOKUPS,
    );
    expect(result?.value).toBeNull();
    expect(result?.errors).toHaveLength(4);
  });

  it('phat hien ma trung trong file', () => {
    const results = validateUserImportRows([row(), row({ rowNumber: 3 })], LOOKUPS);
    expect(results.every((result) => result.errors.length === 1)).toBe(true);
  });

  it('cho phep quan ly la nguoi trong cung file', () => {
    const results = validateUserImportRows(
      [row({ managerCode: 'NV200' }), row({ rowNumber: 3, employeeCode: 'NV200' })],
      LOOKUPS,
    );
    expect(results.flatMap((result) => result.errors)).toEqual([]);
  });

  it('bat buoc mat khau dung quy tac va khong chua ma nhan vien', () => {
    const [empty] = validateUserImportRows([row({ password: '' })], LOOKUPS);
    expect(empty?.value).toBeNull();
    expect(empty?.errors[0]).toContain('ít nhất 8 ký tự');
    const [withCode] = validateUserImportRows([row({ password: 'nv100abcd' })], LOOKUPS);
    expect(withCode?.errors).toEqual(['Mật khẩu không được chứa mã nhân viên']);
  });

  it('khong nhan ngay sai lich', () => {
    const [result] = validateUserImportRows([row({ hiredAt: '31/02/2026' })], LOOKUPS);
    expect(result?.errors[0]).toContain('không hợp lệ');
  });
});

describe('findManagerCycles', () => {
  it('tim vong lap va bo qua nguoi chi tro vao vong', () => {
    const cycles = findManagerCycles([
      { employeeCode: 'A', managerCode: 'B' },
      { employeeCode: 'B', managerCode: 'A' },
      { employeeCode: 'C', managerCode: 'A' },
      { employeeCode: 'D', managerCode: 'D' },
      { employeeCode: 'E', managerCode: '' },
    ]);
    expect([...cycles].sort()).toEqual(['A', 'B', 'D']);
  });
});
