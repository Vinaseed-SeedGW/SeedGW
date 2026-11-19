import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { widestDataScope, type DataScope } from '@seedgw/contracts/access';
import { CHANGE_PASSWORD_PATH } from '@seedgw/contracts/auth';
import {
  CONSENT_LATER_COOKIE,
  LOCATION_CONSENT_KIND,
  LOCATION_CONSENT_PATH,
  LOCATION_CONSENT_VERSION,
} from '@seedgw/contracts/consents';
import { db } from '@seedgw/db/client';
import { auth } from './auth';
import { findActiveImpersonation } from './impersonation';

export type CurrentUser = {
  id: string;
  employeeCode: string;
  fullName: string;
  orgUnitId: string | null;
  roleCodes: string[];
  permissions: ReadonlySet<string>;
  dataScope: DataScope;
  mustChangePassword: boolean;
  /** Chưa đồng ý chia sẻ vị trí bản hiện tại (17/11/2026). Đăng nhập thay thì không hỏi. */
  needsLocationConsent: boolean;
  impersonator: { id: string; fullName: string; sessionId: string } | null;
};

// Doc quyen tu database moi request de thu hoi quyen co hieu luc ngay.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;

  const impersonation = await findActiveImpersonation(id, session.user.sessionVersion);
  const record = await db.user.findUnique({
    where: { id: impersonation?.targetId ?? id },
    select: {
      id: true,
      employeeCode: true,
      fullName: true,
      orgUnitId: true,
      isActive: true,
      mustChangePassword: true,
      sessionVersion: true,
      consents: {
        where: {
          kind: LOCATION_CONSENT_KIND,
          version: LOCATION_CONSENT_VERSION,
          withdrawnAt: null,
        },
        select: { id: true },
        take: 1,
      },
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
  // Khi dang nhap thay, phien va phien ban cua nguoi that da duoc kiem tra o tren.
  if (!impersonation && record.sessionVersion !== session.user.sessionVersion) return null;

  const roles = record.roles.map((userRole) => userRole.role);
  const permissions = new Set(roles.flatMap((role) => role.permissions.map(({ code }) => code)));
  return {
    id: record.id,
    employeeCode: record.employeeCode,
    fullName: record.fullName,
    orgUnitId: record.orgUnitId,
    roleCodes: roles.map((role) => role.code),
    permissions,
    dataScope: widestDataScope(roles.map((role) => role.dataScope)),
    mustChangePassword: !impersonation && record.mustChangePassword,
    // Chỉ hỏi người có quyền check-in, vì vị trí chỉ thu khi check-in trên app.
    needsLocationConsent:
      !impersonation && permissions.has('sales.check-in.create') && record.consents.length === 0,
    impersonator: impersonation
      ? { id, fullName: impersonation.actor.fullName, sessionId: impersonation.id }
      : null,
  };
});

export const requireUser = cache(async (): Promise<CurrentUser> => {
  const user = await getCurrentUser();
  if (user) {
    // Moi trang, query va action deu di qua day nen khong the bo qua buoc doi mat khau.
    if (user.mustChangePassword) redirect(CHANGE_PASSWORD_PATH);
    // Hỏi đồng ý chia sẻ vị trí khi bắt đầu dùng; bấm Không đồng ý thì không hỏi lại trong phiên này.
    if (user.needsLocationConsent && !(await cookies()).has(CONSENT_LATER_COOKIE)) {
      redirect(LOCATION_CONSENT_PATH);
    }
    return user;
  }

  // Phien con han nhung tai khoan da bi khoa thi phai xoa phien, neu khong se lap chuyen huong.
  const session = await auth();
  redirect(session ? '/api/session/expired' : '/login');
});
