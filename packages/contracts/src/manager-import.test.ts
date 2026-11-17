import { describe, expect, it } from 'vitest';
import { validateManagerImportRows, type ManagerImportLookups } from './manager-import';

const lookups: ManagerImportLookups = {
  inScope: new Set(['KD001', 'KD002', 'QL001']),
  activeCodes: new Set(['KD001', 'KD002', 'QL001', 'LD001']),
  currentManagerOf: new Map([['QL001', 'LD001']]),
};

const row = (rowNumber: number, employeeCode: string, managerCode: string) => ({
  rowNumber,
  employeeCode,
  fullName: '',
  managerCode,
});

describe('validateManagerImportRows', () => {
  it('nhận dòng hợp lệ, đánh dấu dòng có đổi', () => {
    const [first, second] = validateManagerImportRows(
      [row(2, 'kd001', 'ql001'), row(3, 'QL001', 'LD001')],
      lookups,
    );
    expect(first).toMatchObject({ employeeCode: 'KD001', managerCode: 'QL001', changed: true });
    expect(first?.errors).toEqual([]);
    expect(second).toMatchObject({ changed: false, errors: [] });
  });

  it('báo mã ngoài phạm vi, quản lý không có, tự quản lý, trùng dòng', () => {
    const result = validateManagerImportRows(
      [
        row(2, 'XX999', ''),
        row(3, 'KD001', 'ZZ1'),
        row(4, 'KD002', 'KD002'),
        row(5, 'KD001', 'QL001'),
      ],
      lookups,
    );
    expect(result[0]?.errors[0]).toContain('ngoài phạm vi');
    expect(result[1]?.errors.join()).toContain('không có hoặc đã khoá');
    expect(result[2]?.errors).toContain('Nhân viên không làm quản lý của chính mình');
    expect(result[3]?.errors.join()).toContain('bị trùng');
  });

  it('chặn vòng quản lý tính cả quan hệ đang có', () => {
    const result = validateManagerImportRows([row(2, 'KD001', 'QL001')], {
      ...lookups,
      currentManagerOf: new Map([['QL001', 'KD001']]),
    });
    expect(result[0]?.errors.join()).toContain('vòng quản lý');
  });
});
