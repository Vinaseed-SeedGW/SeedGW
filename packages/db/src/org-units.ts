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
