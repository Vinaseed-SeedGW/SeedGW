import 'server-only';
import { cache } from 'react';
import { getOrgUnitTreeIds, getTeamUserIds } from '@seedgw/db/org-units';
import { scopedDb } from '@seedgw/db/scoped-client';
import { requireUser } from './current-user';

const getTreeIds = cache(async (orgUnitId: string) => getOrgUnitTreeIds(orgUnitId));

// Query nghiep vu dung client nay de pham vi du lieu luon duoc ap.
export const getScopedDb = cache(async () => {
  const user = await requireUser();
  const needsTree = user.dataScope === 'ORG_UNIT_TREE' && user.orgUnitId !== null;

  return scopedDb({
    dataScope: user.dataScope,
    userId: user.id,
    orgUnitId: user.orgUnitId,
    orgUnitTreeIds: needsTree && user.orgUnitId ? await getTreeIds(user.orgUnitId) : [],
    teamUserIds: user.dataScope === 'TEAM' ? await getTeamUserIds(user.id) : [],
  });
});

// Cac don vi nguoi dung duoc phep xep nhan vien vao, null nghia la tat ca.
export const getAssignableOrgUnitIds = cache(async (): Promise<ReadonlySet<string> | null> => {
  const user = await requireUser();
  if (user.dataScope === 'ALL') return null;
  // Quan ly (TEAM) xep nguoi theo nhom, khong theo don vi, nen khong duoc chuyen don vi.
  if (!user.orgUnitId || user.dataScope === 'OWN' || user.dataScope === 'TEAM') {
    return new Set();
  }
  if (user.dataScope === 'ORG_UNIT') return new Set([user.orgUnitId]);
  return new Set(await getTreeIds(user.orgUnitId));
});
