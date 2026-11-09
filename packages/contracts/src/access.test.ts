import { describe, expect, it } from 'vitest';
import {
  PERMISSIONS,
  ROLE_PRESETS,
  ROUTE_RULES,
  canAccessDepartment,
  canAccessPath,
  departmentLanding,
  permissionForPath,
  scopeWhere,
  widestDataScope,
  type ScopeContext,
} from './access';

function permissionsOf(roleCode: string): ReadonlySet<string> {
  const role = ROLE_PRESETS.find((preset) => preset.code === roleCode);
  if (!role) throw new Error(`Khong co vai tro ${roleCode}`);
  return new Set(role.permissions);
}

const PAGE_PROBES = [
  '/tong-quan',
  '/kinh-doanh/dashboard',
  '/kinh-doanh/can-duyet',
  '/kinh-doanh/don-hang',
  '/kinh-doanh/don-hang/tao-moi',
  '/kinh-doanh/dong-bo-fast',
  '/kinh-doanh/bao-cao',
  '/cskh/hop-thu',
  '/cskh/phieu',
  '/cskh/dashboard',
  '/quan-tri/tai-khoan',
  '/quan-tri/ket-noi',
] as const;

// Ma tran mong doi viet tay de phat hien khi quyen cua vai tro bi doi ngoai y muon.
const EXPECTED_PAGES: Record<string, ReadonlyArray<(typeof PAGE_PROBES)[number]>> = {
  admin: PAGE_PROBES,
  operations: ['/quan-tri/tai-khoan', '/quan-tri/ket-noi'],
  sales: ['/kinh-doanh/dashboard', '/kinh-doanh/don-hang', '/kinh-doanh/don-hang/tao-moi'],
  asm: [
    '/kinh-doanh/dashboard',
    '/kinh-doanh/can-duyet',
    '/kinh-doanh/don-hang',
    '/kinh-doanh/don-hang/tao-moi',
    '/kinh-doanh/bao-cao',
  ],
  'sales-admin': [
    '/kinh-doanh/dashboard',
    '/kinh-doanh/don-hang',
    '/kinh-doanh/don-hang/tao-moi',
    '/kinh-doanh/dong-bo-fast',
    '/kinh-doanh/bao-cao',
  ],
  'customer-care': ['/cskh/hop-thu', '/cskh/phieu'],
  'customer-care-lead': ['/cskh/hop-thu', '/cskh/phieu', '/cskh/dashboard'],
  executive: ['/tong-quan', '/kinh-doanh/dashboard', '/cskh/dashboard'],
};

const EXPECTED_DEPARTMENTS: Record<string, readonly string[]> = {
  admin: ['kinh-doanh', 'cskh', 'quan-tri'],
  operations: ['quan-tri'],
  sales: ['kinh-doanh'],
  asm: ['kinh-doanh'],
  'sales-admin': ['kinh-doanh'],
  'customer-care': ['cskh'],
  'customer-care-lead': ['cskh'],
  executive: ['kinh-doanh', 'cskh'],
};

describe('ma tran vai tro va trang', () => {
  it('moi vai tro deu co trong ma tran', () => {
    expect(Object.keys(EXPECTED_PAGES).sort()).toEqual(ROLE_PRESETS.map((r) => r.code).sort());
  });

  for (const role of ROLE_PRESETS) {
    for (const page of PAGE_PROBES) {
      const allowed = EXPECTED_PAGES[role.code]?.includes(page) ?? false;
      it(`${role.code} ${allowed ? 'duoc vao' : 'bi chan o'} ${page}`, () => {
        expect(canAccessPath(permissionsOf(role.code), page)).toBe(allowed);
      });
    }

    for (const slug of ['kinh-doanh', 'cskh', 'quan-tri'] as const) {
      const allowed = EXPECTED_DEPARTMENTS[role.code]?.includes(slug) ?? false;
      it(`${role.code} ${allowed ? 'thay' : 'khong thay'} bo phan ${slug}`, () => {
        expect(canAccessDepartment(permissionsOf(role.code), slug)).toBe(allowed);
      });
    }
  }
});

describe('danh muc quyen', () => {
  const codes = PERMISSIONS.map((permission) => permission.code);

  it('dat ten theo module.resource.action va khong trung', () => {
    for (const code of codes) expect(code).toMatch(/^[a-z]+\.[a-z-]+\.[a-z]+$/);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('moi quy tac trang va vai tro chi dung quyen co that', () => {
    for (const rule of ROUTE_RULES) expect(codes).toContain(rule.permission);
    for (const role of ROLE_PRESETS) {
      for (const permission of role.permissions) expect(codes).toContain(permission);
    }
  });
});

describe('permissionForPath', () => {
  it('uu tien quy tac dai nhat', () => {
    expect(permissionForPath('/kinh-doanh/don-hang/tao-moi')).toBe('sales.order.create');
    expect(permissionForPath('/kinh-doanh/don-hang/DH-2611-0042')).toBe('sales.order.read');
  });

  it('khong nham duong dan co cung tien to', () => {
    expect(permissionForPath('/kinh-doanh/don-hang-cu')).toBeNull();
  });

  it('chan trang khong co quy tac', () => {
    expect(canAccessPath(permissionsOf('admin'), '/quan-tri/khong-ton-tai')).toBe(false);
  });
});

describe('departmentLanding', () => {
  it('theo vai tro', () => {
    expect(departmentLanding('kinh-doanh', ['sales'], permissionsOf('sales'))).toBe(
      '/kinh-doanh/dashboard',
    );
    expect(departmentLanding('kinh-doanh', ['asm'], permissionsOf('asm'))).toBe(
      '/kinh-doanh/can-duyet',
    );
    expect(departmentLanding('kinh-doanh', ['sales-admin'], permissionsOf('sales-admin'))).toBe(
      '/kinh-doanh/don-hang',
    );
    expect(
      departmentLanding('cskh', ['customer-care-lead'], permissionsOf('customer-care-lead')),
    ).toBe('/cskh/phieu');
    expect(departmentLanding('cskh', ['executive'], permissionsOf('executive'))).toBe(
      '/cskh/dashboard',
    );
  });

  it('chon trang dau tien co quyen khi trang mac dinh bi cam', () => {
    expect(departmentLanding('cskh', ['x'], new Set(['cs.ticket.read']))).toBe('/cskh/phieu');
  });

  it('ve 403 khi khong co quyen nao', () => {
    expect(departmentLanding('quan-tri', [], new Set())).toBe('/403');
  });
});

describe('pham vi du lieu', () => {
  const fields = { ownerField: 'assignedUserId', orgUnitField: 'orgUnitId' };
  const context: ScopeContext = {
    dataScope: 'OWN',
    userId: 'u1',
    orgUnitId: 'o1',
    orgUnitTreeIds: ['o1', 'o2'],
  };

  it('tao dieu kien dung theo tung pham vi', () => {
    expect(scopeWhere(context, fields)).toEqual({ assignedUserId: 'u1' });
    expect(scopeWhere({ ...context, dataScope: 'ORG_UNIT' }, fields)).toEqual({ orgUnitId: 'o1' });
    expect(scopeWhere({ ...context, dataScope: 'ORG_UNIT_TREE' }, fields)).toEqual({
      orgUnitId: { in: ['o1', 'o2'] },
    });
    expect(scopeWhere({ ...context, dataScope: 'ALL' }, fields)).toEqual({});
  });

  it('nguoi chua co don vi chi thay du lieu cua minh', () => {
    const noUnit = { ...context, orgUnitId: null, orgUnitTreeIds: [] };
    expect(scopeWhere({ ...noUnit, dataScope: 'ORG_UNIT' }, fields)).toEqual({
      assignedUserId: 'u1',
    });
    expect(scopeWhere({ ...noUnit, dataScope: 'ORG_UNIT_TREE' }, fields)).toEqual({
      assignedUserId: 'u1',
    });
  });

  it('lay pham vi rong nhat khi co nhieu vai tro', () => {
    expect(widestDataScope(['OWN', 'ORG_UNIT_TREE', 'ORG_UNIT'])).toBe('ORG_UNIT_TREE');
    expect(widestDataScope([])).toBe('OWN');
  });
});
