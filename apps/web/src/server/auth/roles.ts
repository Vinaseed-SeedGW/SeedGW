import 'server-only';
import { cache } from 'react';
import { db } from '@dms/db/client';

export const getRoleCodes = cache(async (userId: string): Promise<string[]> => {
  const userRoles = await db.userRole.findMany({
    where: { userId },
    select: { role: { select: { code: true } } },
  });
  return userRoles.map((userRole) => userRole.role.code);
});

// Tam xet theo vai tro, task F3 se thay bang quyen executive.overview.read.
const EXECUTIVE_ROLES = new Set(['admin', 'executive']);

export function canViewExecutive(roleCodes: readonly string[]): boolean {
  return roleCodes.some((code) => EXECUTIVE_ROLES.has(code));
}
