import { describe, expect, it } from 'vitest';
import {
  buildOrgTree,
  checkOrgUnitMove,
  collectDescendantIds,
  orgDepth,
  orgLevelLabel,
  subtreeHeight,
} from './org-tree';

// cong-ty > mien-bac > vung-1 > kv-1, cong-ty > mien-nam
const UNITS = [
  { id: 'cong-ty', parentId: null, name: 'Công ty' },
  { id: 'mien-nam', parentId: 'cong-ty', name: 'Miền Nam' },
  { id: 'mien-bac', parentId: 'cong-ty', name: 'Miền Bắc' },
  { id: 'vung-1', parentId: 'mien-bac', name: 'Vùng 1' },
  { id: 'kv-1', parentId: 'vung-1', name: 'Khu vực 1' },
];

describe('do sau va chieu cao', () => {
  it('tinh dung', () => {
    expect(orgDepth(UNITS, 'cong-ty')).toBe(1);
    expect(orgDepth(UNITS, 'kv-1')).toBe(4);
    expect(subtreeHeight(UNITS, 'kv-1')).toBe(1);
    expect(subtreeHeight(UNITS, 'mien-bac')).toBe(3);
    expect([...collectDescendantIds(UNITS, 'mien-bac')].sort()).toEqual(['kv-1', 'vung-1']);
  });

  it('khong treo khi du lieu bi vong lap', () => {
    const cycle = [
      { id: 'a', parentId: 'b' },
      { id: 'b', parentId: 'a' },
    ];
    expect(orgDepth(cycle, 'a')).toBe(2);
    expect([...collectDescendantIds(cycle, 'a')].sort()).toEqual(['a', 'b']);
  });

  it('gan nhan cap', () => {
    expect(orgLevelLabel(1)).toBe('Công ty');
    expect(orgLevelLabel(4)).toBe('Khu vực');
  });
});

describe('checkOrgUnitMove', () => {
  it('cho phep chuyen hop le', () => {
    expect(checkOrgUnitMove(UNITS, 'vung-1', 'mien-nam')).toEqual({ ok: true });
  });

  it.each([
    ['chuyen goc', 'cong-ty', 'mien-bac'],
    ['vao chinh no', 'vung-1', 'vung-1'],
    ['vao cap duoi', 'mien-bac', 'kv-1'],
    ['cung cha cu', 'vung-1', 'mien-bac'],
    ['cha khong ton tai', 'vung-1', 'khong-co'],
    ['don vi khong ton tai', 'khong-co', 'mien-nam'],
  ])('tu choi %s', (_name, id, target) => {
    expect(checkOrgUnitMove(UNITS, id, target).ok).toBe(false);
  });

  it('khong cho vuot qua 4 cap', () => {
    const result = checkOrgUnitMove(UNITS, 'vung-1', 'kv-other');
    expect(result.ok).toBe(false);
    const deep = [...UNITS, { id: 'vung-2', parentId: 'mien-nam', name: 'Vùng 2' }];
    expect(checkOrgUnitMove(deep, 'vung-1', 'vung-2').ok).toBe(false);
    expect(checkOrgUnitMove(deep, 'kv-1', 'vung-2').ok).toBe(true);
  });
});

describe('buildOrgTree', () => {
  it('xep theo ten va gan do sau', () => {
    const [root] = buildOrgTree(UNITS);
    expect(root?.depth).toBe(1);
    expect(root?.children.map((child) => child.name)).toEqual(['Miền Bắc', 'Miền Nam']);
    expect(root?.children[0]?.children[0]?.children[0]?.depth).toBe(4);
  });
});
