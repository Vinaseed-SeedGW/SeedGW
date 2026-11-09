import 'server-only';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { widestDataScope, type DataScope } from '@dms/contracts/access';
import { db } from '@dms/db/client';
import { auth } from './auth';

export type CurrentUser = {
  id: string;
  employeeCode: string;
  fullName: string;
  orgUnitId: string | null;
  roleCodes: string[];
  permissions: ReadonlySet<string>;
  dataScope: DataScope;
};

// Doc quyen tu database moi request de thu hoi quyen co hieu luc ngay.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;

  const record = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      employeeCode: true,
      fullName: true,
      orgUnitId: true,
      isActive: true,
      roles: {
        select: {
          role: {
            select: { code: true, dataScope: true, permissions: { select: { code: true } } },
          },
        },
      },
    },
  });
  if (!record || !record.isActive) return null;

  const roles = record.roles.map((userRole) => userRole.role);
  return {
    id: record.id,
    employeeCode: record.employeeCode,
    fullName: record.fullName,
    orgUnitId: record.orgUnitId,
    roleCodes: roles.map((role) => role.code),
    permissions: new Set(roles.flatMap((role) => role.permissions.map(({ code }) => code))),
    dataScope: widestDataScope(roles.map((role) => role.dataScope)),
  };
});

export const requireUser = cache(async (): Promise<CurrentUser> => {
  const user = await getCurrentUser();
  if (user) return user;

  // Phien con han nhung tai khoan da bi khoa thi phai xoa phien, neu khong se lap chuyen huong.
  const session = await auth();
  redirect(session ? '/api/session/expired' : '/login');
});
