'use client';

import { useMemo } from 'react';
import type { RoleMatrixRole } from '@dms/contracts/roles';
import {
  RoleMatrix,
  draftsFromRoles,
  type RoleMatrixContextValue,
} from '@/features/roles/components/role-matrix';

const READ_ONLY_REASON = 'Bạn chỉ có quyền xem';
const NO_OP = () => undefined;

export function RoleMatrixReadOnly({ roles }: { roles: RoleMatrixRole[] }) {
  const value = useMemo<RoleMatrixContextValue>(
    () => ({
      state: { drafts: draftsFromRoles(roles) },
      actions: { togglePermission: NO_OP, setDataScope: NO_OP },
      meta: {
        roles,
        scopeLockReason: () => READ_ONLY_REASON,
        cellLockReason: () => READ_ONLY_REASON,
      },
    }),
    [roles],
  );

  return (
    <RoleMatrix.Provider value={value}>
      <RoleMatrix.Table />
    </RoleMatrix.Provider>
  );
}
