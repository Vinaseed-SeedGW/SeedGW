import type { ReactNode } from 'react';
import type { PermissionCode } from '@seedgw/contracts/access';
import { can } from '@/server/auth/can';
import { requireUser } from '@/server/auth/current-user';

type CanProps = {
  permission: PermissionCode;
  children: ReactNode;
};

// Chi de an phan khong lien quan. Quyen van phai duoc kiem o trang va action.
export async function Can({ permission, children }: CanProps) {
  const user = await requireUser();
  return can(user, permission) ? children : null;
}
