import 'server-only';
import { redirect } from 'next/navigation';
import {
  FORBIDDEN_PATH,
  canAccessDepartment,
  canAccessPath,
  type PermissionCode,
} from '@dms/contracts/access';
import type { DepartmentSlug } from '@dms/contracts/departments';
import { requireUser, type CurrentUser } from './current-user';

export class ForbiddenError extends Error {
  constructor(readonly permission: PermissionCode) {
    super(`Thieu quyen ${permission}`);
  }
}

export function can(user: CurrentUser, permission: PermissionCode): boolean {
  return user.permissions.has(permission);
}

// Dung o dong dau cua Server Action va Route Handler.
export function assertCan(user: CurrentUser, permission: PermissionCode): void {
  if (!can(user, permission)) throw new ForbiddenError(permission);
}

// Ba ham duoi dung cho trang va layout, thieu quyen thi chuyen sang trang 403.
export async function requirePermission(permission: PermissionCode): Promise<CurrentUser> {
  const user = await requireUser();
  if (!can(user, permission)) redirect(FORBIDDEN_PATH);
  return user;
}

export async function requirePathAccess(pathname: string): Promise<CurrentUser> {
  const user = await requireUser();
  if (!canAccessPath(user.permissions, pathname)) redirect(FORBIDDEN_PATH);
  return user;
}

export async function requireDepartmentAccess(slug: DepartmentSlug): Promise<CurrentUser> {
  const user = await requireUser();
  if (!canAccessDepartment(user.permissions, slug)) redirect(FORBIDDEN_PATH);
  return user;
}
