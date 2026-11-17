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
