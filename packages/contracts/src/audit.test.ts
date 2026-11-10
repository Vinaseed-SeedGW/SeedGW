import { describe, expect, it } from 'vitest';
import { auditChanges, auditUrlParams, formatAuditValue } from './audit';

describe('auditUrlParams', () => {
  it('doi tham so URL sang bo loc', () => {
    expect(
      auditUrlParams.parse({
        q: ' an ',
        'doi-tuong': 'Role',
        'tu-ngay': '2026-11-01',
        'den-ngay': '2026-11-10',
        trang: '2',
      }),
    ).toEqual({
      q: 'an',
      entityType: 'Role',
      from: '2026-11-01',
      to: '2026-11-10',
      page: 2,
      pageSize: 20,
    });
  });

  it('bo qua gia tri sai', () => {
    const parsed = auditUrlParams.parse({
      'doi-tuong': 'XoaHet',
      'tu-ngay': '2026-02-31',
      'den-ngay': ['2026-11-10', '2026-11-11'],
      trang: 'a',
    });
    expect(parsed).toMatchObject({
      entityType: undefined,
      from: undefined,
      to: undefined,
      page: 1,
    });
  });

  it('tu doi cho khi khoang ngay nguoc', () => {
    const parsed = auditUrlParams.parse({ 'tu-ngay': '2026-11-10', 'den-ngay': '2026-11-01' });
    expect(parsed).toMatchObject({ from: '2026-11-01', to: '2026-11-10' });
  });
});

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
