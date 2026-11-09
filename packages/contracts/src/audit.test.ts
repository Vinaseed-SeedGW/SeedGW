import { describe, expect, it } from 'vitest';
import { auditChanges, formatAuditValue } from './audit';

describe('auditChanges', () => {
  it('chi ghi truong thay doi', () => {
    expect(
      auditChanges({ fullName: 'A', isActive: true }, { fullName: 'B', isActive: true }),
    ).toEqual({ fullName: { before: 'A', after: 'B' } });
  });

  it('khong co gi khi du lieu giong het', () => {
    expect(auditChanges({ a: 1 }, { a: 1 })).toEqual({});
  });

  it('coi truong thieu la null', () => {
    expect(auditChanges({ a: 'x' }, {})).toEqual({ a: { before: 'x', after: null } });
    expect(auditChanges({ a: null }, {})).toEqual({});
  });
});

describe('formatAuditValue', () => {
  it('hien gia tri de doc', () => {
    expect(formatAuditValue(true)).toBe('Có');
    expect(formatAuditValue(false)).toBe('Không');
    expect(formatAuditValue(null)).toBe('(trống)');
    expect(formatAuditValue('A')).toBe('A');
  });
});
