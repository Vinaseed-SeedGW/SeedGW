import { db } from './client';

export async function getOrgUnitTreeIds(rootId: string): Promise<string[]> {
  const rows = await db.$queryRaw<Array<{ id: string }>>`
    WITH RECURSIVE tree AS (
      SELECT id FROM org_units WHERE id = ${rootId}::uuid
      UNION
      SELECT child.id FROM org_units child JOIN tree ON child.parent_id = tree.id
    )
    SELECT id FROM tree
  `;
  return rows.map((row) => row.id);
}

/** Pham vi TEAM (vai tro Quan ly): chinh minh va nhan vien dang hoat dong co minh la Quan ly truc tiep. */
export async function getTeamUserIds(managerId: string): Promise<string[]> {
  const reports = await db.user.findMany({
    where: { managerId, isActive: true },
    select: { id: true },
  });
  return [managerId, ...reports.map((user) => user.id)];
}

/** Đơn vị và mọi đơn vị cha của nó, dùng tìm Quản trị đơn vị nhận yêu cầu hỗ trợ (T1). */
export async function getOrgUnitAncestorIds(unitId: string): Promise<string[]> {
  const rows = await db.$queryRaw<Array<{ id: string }>>`
    WITH RECURSIVE chain AS (
      SELECT id, parent_id FROM org_units WHERE id = ${unitId}::uuid
      UNION
      SELECT parent.id, parent.parent_id FROM org_units parent JOIN chain ON chain.parent_id = parent.id
    )
    SELECT id FROM chain
  `;
  return rows.map((row) => row.id);
}
