import { describe, expect, it } from 'vitest';
import {
  PERMISSIONS,
  RESERVED_PERMISSIONS,
  ROLE_PRESETS,
  ROUTE_RULES,
  SYSTEM_ROLE_CODE,
  activeNavHref,
  canAccessDepartment,
  canAccessPath,
  departmentLanding,
  permissionForPath,
  roleExceedsActor,
  scopeWhere,
  showsSupportButton,
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
  '/kinh-doanh/dai-ly',
  '/kinh-doanh/check-in',
  '/kinh-doanh/bao-cao',
  '/quan-tri/ho-tro',
  '/quan-tri/tai-khoan',
  '/quan-tri/dai-ly/nhap-excel',
  '/quan-tri/ket-noi',
] as const;

// Ma tran mong doi viet tay de phat hien khi quyen cua vai tro bi doi ngoai y muon.
const EXPECTED_PAGES: Record<string, ReadonlyArray<(typeof PAGE_PROBES)[number]>> = {
  admin: PAGE_PROBES,
  operations: [
    '/kinh-doanh/dashboard',
    '/kinh-doanh/dai-ly',
    '/kinh-doanh/check-in',
    '/kinh-doanh/bao-cao',
    '/quan-tri/ho-tro',
    '/quan-tri/tai-khoan',
  ],
  'unit-leader': [
    '/tong-quan',
    '/kinh-doanh/dashboard',
    '/kinh-doanh/dai-ly',
    '/kinh-doanh/check-in',
    '/kinh-doanh/bao-cao',
  ],
  manager: [
    '/kinh-doanh/dashboard',
    '/kinh-doanh/dai-ly',
    '/kinh-doanh/check-in',
    '/kinh-doanh/bao-cao',
  ],
  staff: ['/kinh-doanh/dashboard', '/kinh-doanh/dai-ly', '/kinh-doanh/check-in'],
};

const EXPECTED_DEPARTMENTS: Record<string, readonly string[]> = {
  admin: ['kinh-doanh', 'quan-tri'],
  operations: ['kinh-doanh', 'quan-tri'],
  'unit-leader': ['kinh-doanh'],
  manager: ['kinh-doanh'],
  staff: ['kinh-doanh'],
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

    for (const slug of ['kinh-doanh', 'quan-tri'] as const) {
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

describe('quyen danh rieng', () => {
  it('chi Quan tri he thong co', () => {
    for (const role of ROLE_PRESETS) {
      for (const code of RESERVED_PERMISSIONS) {
        expect(role.permissions.includes(code)).toBe(role.code === SYSTEM_ROLE_CODE);
      }
    }
  });
});

describe('roleExceedsActor', () => {
  const unitAdmin = {
    permissions: permissionsOf('operations'),
    dataScope: 'ORG_UNIT_TREE' as const,
  };

  function presetAuthority(code: string) {
    const preset = ROLE_PRESETS.find((role) => role.code === code);
    if (!preset) throw new Error(`Khong co vai tro ${code}`);
    return {
      dataScope: preset.dataScope,
      permissions: preset.permissions.map((permission) => ({ code: permission })),
    };
  }

  it('Quan tri don vi gan duoc vai tro nghiep vu trong pham vi cua minh', () => {
    expect(roleExceedsActor(unitAdmin, presetAuthority('staff'))).toBe(false);
    expect(roleExceedsActor(unitAdmin, presetAuthority('operations'))).toBe(false);
  });

  it('Quan tri don vi khong gan duoc vai tro co pham vi toan cong ty', () => {
    expect(roleExceedsActor(unitAdmin, presetAuthority('admin'))).toBe(true);
  });

  it('khong gan duoc vai tro co quyen quan tri minh khong co', () => {
    const role = { dataScope: 'OWN' as const, permissions: [{ code: 'admin.setting.read' }] };
    expect(roleExceedsActor(unitAdmin, role)).toBe(true);
  });

  it('Quan tri he thong gan duoc moi vai tro', () => {
    const admin = { permissions: permissionsOf('admin'), dataScope: 'ALL' as const };
    for (const role of ROLE_PRESETS) {
      expect(roleExceedsActor(admin, presetAuthority(role.code))).toBe(false);
    }
  });
});

describe('activeNavHref', () => {
  const hrefs = ['/quan-tri/dai-ly', '/quan-tri/dai-ly/duyet-toa-do', '/quan-tri/tham-so'];

  it('chi sang muc khop dai nhat', () => {
    expect(activeNavHref('/quan-tri/dai-ly/duyet-toa-do', hrefs)).toBe(
      '/quan-tri/dai-ly/duyet-toa-do',
    );
    expect(activeNavHref('/quan-tri/dai-ly/abc-123', hrefs)).toBe('/quan-tri/dai-ly');
    expect(activeNavHref('/quan-tri/dai-ly', hrefs)).toBe('/quan-tri/dai-ly');
  });

  it('khong nham tien to cung chu', () => {
    expect(activeNavHref('/quan-tri/dai-ly-cu', hrefs)).toBeNull();
  });
});

describe('permissionForPath', () => {
  it('uu tien quy tac dai nhat', () => {
    expect(permissionForPath('/quan-tri/dai-ly/nhap-excel')).toBe('admin.dealer.manage');
    expect(permissionForPath('/quan-tri/dai-ly/6f1c1d2e-3a4b-4c5d-8e9f-0a1b2c3d4e5f')).toBe(
      'admin.dealer.read',
    );
  });

  it('khong nham duong dan co cung tien to', () => {
    expect(permissionForPath('/kinh-doanh/dai-ly-cu')).toBeNull();
  });

  it('chan trang khong co quy tac', () => {
    expect(canAccessPath(permissionsOf('admin'), '/quan-tri/khong-ton-tai')).toBe(false);
  });
});

describe('departmentLanding', () => {
  it('theo vai tro', () => {
    expect(departmentLanding('kinh-doanh', ['staff'], permissionsOf('staff'))).toBe(
      '/kinh-doanh/dashboard',
    );
    expect(departmentLanding('kinh-doanh', ['operations'], permissionsOf('operations'))).toBe(
      '/kinh-doanh/check-in',
    );
    expect(departmentLanding('quan-tri', ['operations'], permissionsOf('operations'))).toBe(
      '/quan-tri/ho-tro',
    );
    expect(departmentLanding('quan-tri', ['admin'], permissionsOf('admin'))).toBe(
      '/quan-tri/tai-khoan',
    );
  });

  it('chon trang dau tien co quyen khi trang mac dinh bi cam', () => {
    expect(departmentLanding('kinh-doanh', ['x'], new Set(['sales.check-in.read']))).toBe(
      '/kinh-doanh/check-in',
    );
  });

  it('ve 403 khi khong co quyen nao', () => {
    expect(departmentLanding('quan-tri', [], new Set())).toBe('/403');
  });
});

describe('nut noi Ho tro', () => {
  it('chi hien cho nguoi gui, khong hien cho nguoi xu ly', () => {
    expect(showsSupportButton(permissionsOf('staff'))).toBe(true);
    expect(showsSupportButton(permissionsOf('operations'))).toBe(false);
    expect(showsSupportButton(permissionsOf('admin'))).toBe(false);
    expect(showsSupportButton(new Set())).toBe(false);
  });
});

describe('pham vi du lieu', () => {
  const fields = { ownerField: 'assignedUserId', orgUnitField: 'orgUnitId' };
  const context: ScopeContext = {
    dataScope: 'OWN',
    userId: 'u1',
    orgUnitId: 'o1',
    orgUnitTreeIds: ['o1', 'o2'],
    teamUserIds: ['u1', 'u2', 'u3'],
  };

  it('tao dieu kien dung theo tung pham vi', () => {
    expect(scopeWhere(context, fields)).toEqual({ assignedUserId: 'u1' });
    expect(scopeWhere({ ...context, dataScope: 'ORG_UNIT' }, fields)).toEqual({ orgUnitId: 'o1' });
    expect(scopeWhere({ ...context, dataScope: 'ORG_UNIT_TREE' }, fields)).toEqual({
      orgUnitId: { in: ['o1', 'o2'] },
    });
    expect(scopeWhere({ ...context, dataScope: 'ALL' }, fields)).toEqual({});
    expect(scopeWhere({ ...context, dataScope: 'TEAM' }, fields)).toEqual({
      assignedUserId: { in: ['u1', 'u2', 'u3'] },
    });
  });

  it('Quan ly chua co cap duoi chi thay cua minh', () => {
    expect(scopeWhere({ ...context, dataScope: 'TEAM', teamUserIds: [] }, fields)).toEqual({
      assignedUserId: 'u1',
    });
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
