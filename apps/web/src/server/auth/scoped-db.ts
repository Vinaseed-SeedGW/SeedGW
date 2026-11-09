import 'server-only';
import { cache } from 'react';
import { getOrgUnitTreeIds } from '@dms/db/org-units';
import { scopedDb } from '@dms/db/scoped-client';
import { requireUser } from './current-user';

// Query nghiep vu dung client nay de pham vi du lieu luon duoc ap.
export const getScopedDb = cache(async () => {
  const user = await requireUser();
  const needsTree = user.dataScope === 'ORG_UNIT_TREE' && user.orgUnitId !== null;

  return scopedDb({
    dataScope: user.dataScope,
    userId: user.id,
    orgUnitId: user.orgUnitId,
    orgUnitTreeIds: needsTree && user.orgUnitId ? await getOrgUnitTreeIds(user.orgUnitId) : [],
  });
});
