// Tach khoi org-units.ts de phan keo tha tren trinh duyet khong phai tai zod.
export const MAX_ORG_DEPTH = 4;

const ORG_LEVEL_LABEL = ['Công ty', 'Miền', 'Vùng', 'Khu vực'] as const;

export function orgLevelLabel(depth: number): string {
  return ORG_LEVEL_LABEL[depth - 1] ?? `Cấp ${depth}`;
}

export type OrgUnitLink = { id: string; parentId: string | null };

function parentMap(units: readonly OrgUnitLink[]) {
  return new Map(units.map((unit) => [unit.id, unit.parentId]));
}

function childrenMap(units: readonly OrgUnitLink[]) {
  const children = new Map<string, string[]>();
  for (const unit of units) {
    if (unit.parentId === null) continue;
    children.set(unit.parentId, [...(children.get(unit.parentId) ?? []), unit.id]);
  }
  return children;
}

// Goc co do sau bang 1.
export function orgDepth(units: readonly OrgUnitLink[], id: string): number {
  const parents = parentMap(units);
  const visited = new Set<string>();
  let depth = 0;
  let current: string | null | undefined = id;
  while (current && !visited.has(current)) {
    visited.add(current);
    depth += 1;
    current = parents.get(current);
  }
  return depth;
}

export function collectDescendantIds(units: readonly OrgUnitLink[], id: string): Set<string> {
  const children = childrenMap(units);
  const found = new Set<string>();
  const pending = [...(children.get(id) ?? [])];
  while (pending.length > 0) {
    const next = pending.pop() as string;
    if (found.has(next)) continue;
    found.add(next);
    pending.push(...(children.get(next) ?? []));
  }
  return found;
}

// Mot nut khong co con co chieu cao bang 1.
export function subtreeHeight(units: readonly OrgUnitLink[], id: string): number {
  const baseDepth = orgDepth(units, id);
  let deepest = baseDepth;
  for (const descendant of collectDescendantIds(units, id)) {
    deepest = Math.max(deepest, orgDepth(units, descendant));
  }
  return deepest - baseDepth + 1;
}

export type OrgMoveCheck = { ok: true } | { ok: false; reason: string };

export function checkOrgUnitMove(
  units: readonly OrgUnitLink[],
  id: string,
  newParentId: string,
): OrgMoveCheck {
  const unit = units.find((item) => item.id === id);
  if (!unit) return { ok: false, reason: 'Không tìm thấy đơn vị này' };
  if (unit.parentId === null) return { ok: false, reason: 'Không thể chuyển đơn vị gốc' };
  if (!units.some((item) => item.id === newParentId)) {
    return { ok: false, reason: 'Không tìm thấy đơn vị cha' };
  }
  if (unit.parentId === newParentId) {
    return { ok: false, reason: 'Đơn vị đã nằm trong đơn vị cha này' };
  }
  if (id === newParentId || collectDescendantIds(units, id).has(newParentId)) {
    return { ok: false, reason: 'Không thể chuyển đơn vị vào chính nó hoặc cấp dưới của nó' };
  }
  if (orgDepth(units, newParentId) + subtreeHeight(units, id) > MAX_ORG_DEPTH) {
    return { ok: false, reason: `Cơ cấu tổ chức chỉ có tối đa ${MAX_ORG_DEPTH} cấp` };
  }
  return { ok: true };
}

export type OrgTreeNode<T> = T & { depth: number; children: OrgTreeNode<T>[] };

export function buildOrgTree<T extends OrgUnitLink & { name: string }>(
  units: readonly T[],
): OrgTreeNode<T>[] {
  const byParent = new Map<string | null, T[]>();
  for (const unit of units) {
    byParent.set(unit.parentId, [...(byParent.get(unit.parentId) ?? []), unit]);
  }

  const build = (parentId: string | null, depth: number): OrgTreeNode<T>[] =>
    [...(byParent.get(parentId) ?? [])]
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
      .map((unit) => ({ ...unit, depth, children: build(unit.id, depth + 1) }));

  return build(null, 1);
}

// Dan phang cay theo thu tu hien thi, ten co gach dau dong de chon trong o select.
export function flattenOrgTree<T extends { name: string }>(
  nodes: ReadonlyArray<OrgTreeNode<T>>,
): T[] {
  return nodes.flatMap((node) => [
    { ...node, name: `${'-- '.repeat(node.depth - 1)}${node.name}` },
    ...flattenOrgTree<T>(node.children),
  ]);
}
