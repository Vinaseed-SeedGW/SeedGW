import { describe, expect, it } from 'vitest';
import { PERMISSIONS, canAccessPath } from './access';
import {
  PERMISSION_GROUPS,
  createRoleInput,
  diffPermissionCodes,
  isPermissionReserved,
  isPresetRole,
  roleLockReason,
  saveRoleMatrixInput,
} from './roles';

describe('PERMISSION_GROUPS', () => {
  it('moi quyen thuoc dung mot nhom', () => {
    const grouped = PERMISSION_GROUPS.flatMap((group) => group.permissions.map(({ code }) => code));
    expect(grouped.sort()).toEqual(PERMISSIONS.map(({ code }) => code).sort());
  });
});

describe('roleLockReason', () => {
  it('khoa vai tro Quan tri he thong', () => {
    expect(roleLockReason('admin', false)).toBe('Vai trò này luôn có đủ quyền');
  });

  it('khoa vai tro nguoi dung dang giu', () => {
    expect(roleLockReason('asm', true)).toBe('Bạn đang giữ vai trò này nên không sửa được');
  });

  it('cho sua vai tro con lai', () => {
    expect(roleLockReason('asm', false)).toBeNull();
  });
});

describe('quyen danh rieng va vai tro mac dinh', () => {
  it('nhan dung quyen danh rieng', () => {
    expect(isPermissionReserved('admin.role.manage')).toBe(true);
    expect(isPermissionReserved('admin.user.impersonate')).toBe(true);
    expect(isPermissionReserved('sales.dealer.update')).toBe(false);
  });

  it('nhan dung vai tro mac dinh', () => {
    expect(isPresetRole('asm')).toBe(true);
    expect(isPresetRole('giam-doc-mien')).toBe(false);
  });
});

describe('diffPermissionCodes', () => {
  it('tach quyen them va bo', () => {
    expect(diffPermissionCodes(['a', 'b'], ['b', 'c'])).toEqual({ added: ['c'], removed: ['a'] });
  });

  it('khong doi khi cung tap quyen khac thu tu', () => {
    expect(diffPermissionCodes(['a', 'b'], ['b', 'a'])).toEqual({ added: [], removed: [] });
  });
});

describe('bo quyen co hieu luc voi quy tac trang', () => {
  it('thieu quyen thi khong vao duoc trang can quyen do', () => {
    const asm = new Set(['sales.check-in.read', 'sales.dealer.read']);
    expect(canAccessPath(asm, '/kinh-doanh/check-in')).toBe(true);
    asm.delete('sales.check-in.read');
    expect(canAccessPath(asm, '/kinh-doanh/check-in')).toBe(false);
  });
});

describe('createRoleInput', () => {
  it('chuan hoa ma ve chu thuong', () => {
    const parsed = createRoleInput.parse({
      code: ' Giam-Doc-Mien ',
      name: 'Giám đốc miền',
      dataScope: 'ORG_UNIT_TREE',
    });
    expect(parsed.code).toBe('giam-doc-mien');
  });

  it('tu choi ma co dau', () => {
    const result = createRoleInput.safeParse({
      code: 'giám-đốc',
      name: 'Giám đốc',
      dataScope: 'ALL',
    });
    expect(result.success).toBe(false);
  });
});

describe('saveRoleMatrixInput', () => {
  const base = {
    id: '6f9619ff-8b86-4d01-b42d-00cf4fc964ff',
    expectedUpdatedAt: '2026-11-10T04:00:00.000Z',
    dataScope: 'OWN',
  };

  it('nhan ma quyen co that', () => {
    const result = saveRoleMatrixInput.safeParse({
      roles: [{ ...base, permissionCodes: ['sales.dealer.update'] }],
    });
    expect(result.success).toBe(true);
  });

  it('tu choi ma quyen khong ton tai', () => {
    const result = saveRoleMatrixInput.safeParse({
      roles: [{ ...base, permissionCodes: ['sales.dealer.xoa-het'] }],
    });
    expect(result.success).toBe(false);
  });
});
