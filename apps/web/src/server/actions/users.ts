'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { z } from 'zod';
import type { ActionResult, ExportedFile } from '@dms/contracts/common';
import { MAX_EXPORT_ROWS } from '@dms/contracts/common';
import { formatDate } from '@dms/contracts/format';
import {
  MOBILE_DEVICE_STATUS_LABEL,
  createUserInput,
  exportUsersInput,
  setMobileDeviceStatusInput,
  setUsersActiveInput,
  updateUserInput,
  type CreatedUser,
  type MobileDeviceStatus,
  type UserSummary,
} from '@dms/contracts/users';
import { toActionError, validationError } from '@/server/auth/action-error';
import { assertCan } from '@/server/auth/can';
import { requireUser } from '@/server/auth/current-user';
import { getScopedDb } from '@/server/auth/scoped-db';
import { USER_SUMMARY_SELECT, toUserSummary, userOrderBy, userWhere } from '@/server/queries/users';
import { getClientIp, writeAudit, writeAuditMany } from '@/server/services/audit';
import { buildWorkbookBase64, type ExcelColumn } from '@/server/services/excel';
import { startImpersonation, stopImpersonation } from '@/server/services/impersonation';
import {
  createUser,
  resetUserPassword,
  setMobileDeviceStatus,
  setUsersActive,
  updateUser,
} from '@/server/services/users';

const NOT_FOUND_RESULT = {
  ok: false,
  code: 'NOT_FOUND',
  message: 'Không tìm thấy tài khoản này',
} as const;

const USER_EXPORT_COLUMNS: ReadonlyArray<ExcelColumn<UserSummary>> = [
  { header: 'Mã nhân viên', width: 16, value: (row) => row.employeeCode },
  { header: 'Họ tên', width: 30, value: (row) => row.fullName },
  { header: 'Đơn vị', width: 24, value: (row) => row.orgUnitName ?? '' },
  { header: 'Chức danh', width: 24, value: (row) => row.jobTitle ?? '' },
  { header: 'Vai trò', width: 30, value: (row) => row.roleNames.join(', ') },
  {
    header: 'Trạng thái',
    width: 14,
    value: (row) => (row.status === 'ACTIVE' ? 'Hoạt động' : 'Đã khoá'),
  },
  { header: 'Ngày tạo', width: 14, value: (row) => formatDate(row.createdAt) },
];

function revalidateAccounts() {
  revalidatePath('/quan-tri/tai-khoan', 'layout');
}

export async function createUserAction(raw: unknown): Promise<ActionResult<CreatedUser>> {
  try {
    const user = await requireUser();
    assertCan(user, 'admin.user.manage');

    const parsed = createUserInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);

    const [{ changes, ...created }, ip] = await Promise.all([
      createUser(user, parsed.data),
      getClientIp(),
    ]);

    after(() =>
      writeAudit({
        actor: user,
        action: 'user.create',
        entityType: 'User',
        entityId: created.id,
        entityLabel: created.employeeCode,
        changes,
        ip,
      }),
    );
    revalidateAccounts();
    return { ok: true, data: created };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateUserAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    assertCan(user, 'admin.user.manage');

    const parsed = updateUserInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);
    const input = parsed.data;

    const [outcome, ip] = await Promise.all([updateUser(user, input), getClientIp()]);
    if (!outcome) return NOT_FOUND_RESULT;

    if (Object.keys(outcome.changes).length > 0) {
      after(() =>
        writeAudit({
          actor: user,
          action: 'user.update',
          entityType: 'User',
          entityId: input.id,
          entityLabel: outcome.employeeCode,
          changes: outcome.changes,
          ip,
        }),
      );
      revalidateAccounts();
    }
    return { ok: true, data: { id: input.id } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function setUsersActiveAction(
  raw: unknown,
): Promise<ActionResult<{ changed: number; skipped: number }>> {
  try {
    const user = await requireUser();
    assertCan(user, 'admin.user.manage');

    const parsed = setUsersActiveInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);
    const { ids, isActive } = parsed.data;

    const [{ changed, skipped }, ip] = await Promise.all([
      setUsersActive(user, ids, isActive),
      getClientIp(),
    ]);
    if (changed.length === 0) {
      return {
        ok: false,
        code: 'CONFLICT',
        message:
          'Không có tài khoản nào thay đổi. Bạn không thể khoá chính mình hoặc tài khoản có quyền cao hơn.',
      };
    }

    after(() =>
      writeAuditMany(
        changed.map((target) => ({
          actor: user,
          action: isActive ? ('user.unlock' as const) : ('user.lock' as const),
          entityType: 'User',
          entityId: target.id,
          entityLabel: target.employeeCode,
          changes: { isActive: { before: !isActive, after: isActive } },
          ip,
        })),
      ),
    );
    revalidateAccounts();
    return { ok: true, data: { changed: changed.length, skipped } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function resetUserPasswordAction(
  rawId: unknown,
): Promise<ActionResult<{ temporaryPassword: string }>> {
  try {
    const user = await requireUser();
    assertCan(user, 'admin.user.manage');

    const id = z.uuid().safeParse(rawId);
    if (!id.success) return validationError(id.error);

    const [outcome, ip] = await Promise.all([resetUserPassword(user, id.data), getClientIp()]);
    if (!outcome) return NOT_FOUND_RESULT;

    after(() =>
      writeAudit({
        actor: user,
        action: 'user.reset-password',
        entityType: 'User',
        entityId: id.data,
        entityLabel: outcome.employeeCode,
        changes: {},
        ip,
      }),
    );
    revalidateAccounts();
    return { ok: true, data: { temporaryPassword: outcome.temporaryPassword } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function setMobileDeviceStatusAction(
  raw: unknown,
): Promise<ActionResult<{ deviceId: string }>> {
  try {
    const user = await requireUser();
    assertCan(user, 'admin.user.manage');

    const parsed = setMobileDeviceStatusInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);
    const { deviceId, status } = parsed.data;

    const [outcome, ip] = await Promise.all([
      setMobileDeviceStatus(user, deviceId, status),
      getClientIp(),
    ]);
    if (!outcome) return { ok: false, code: 'NOT_FOUND', message: 'Không tìm thấy thiết bị này' };

    after(() =>
      writeAudit({
        actor: user,
        action: status === 'ACTIVE' ? 'user.device-approve' : 'user.device-revoke',
        entityType: 'User',
        entityId: outcome.userId,
        entityLabel: outcome.employeeCode,
        changes: {
          device: {
            before: `${outcome.deviceName}: ${MOBILE_DEVICE_STATUS_LABEL[outcome.previousStatus as MobileDeviceStatus]}`,
            after: `${outcome.deviceName}: ${MOBILE_DEVICE_STATUS_LABEL[status]}`,
          },
        },
        ip,
      }),
    );
    revalidateAccounts();
    return { ok: true, data: { deviceId } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function startImpersonationAction(rawId: unknown): Promise<ActionResult<never>> {
  try {
    const user = await requireUser();
    assertCan(user, 'admin.user.impersonate');

    const id = z.uuid().safeParse(rawId);
    if (!id.success) return validationError(id.error);

    const [outcome, ip] = await Promise.all([startImpersonation(user, id.data), getClientIp()]);
    if (!outcome) return NOT_FOUND_RESULT;

    await writeAudit({
      actor: user,
      action: 'user.impersonate-start',
      entityType: 'User',
      entityId: outcome.targetId,
      entityLabel: outcome.employeeCode,
      changes: {},
      ip,
    });
  } catch (error) {
    return toActionError(error);
  }
  redirect('/hub');
}

export async function stopImpersonationAction(): Promise<void> {
  const user = await requireUser();
  const impersonator = user.impersonator;
  if (impersonator) {
    const ip = await getClientIp();
    await stopImpersonation(user);
    await writeAudit({
      actor: { id: impersonator.id, impersonator: null },
      action: 'user.impersonate-stop',
      entityType: 'User',
      entityId: user.id,
      entityLabel: user.employeeCode,
      changes: {},
      ip,
    });
    redirect(`/quan-tri/tai-khoan/${user.id}`);
  }
  redirect('/hub');
}

export async function exportUsersAction(
  rawFilter: unknown,
  rawIds: unknown,
): Promise<ActionResult<ExportedFile>> {
  try {
    const user = await requireUser();
    assertCan(user, 'admin.user.export');

    const parsed = exportUsersInput.safeParse({ filter: rawFilter, ids: rawIds });
    if (!parsed.success) return validationError(parsed.error);
    const { filter, ids } = parsed.data;

    const scoped = await getScopedDb();
    const where = { ...userWhere(filter), ...(ids.length > 0 ? { id: { in: ids } } : {}) };

    const total = await scoped.user.count({ where });
    if (total > MAX_EXPORT_ROWS) {
      return {
        ok: false,
        code: 'CONFLICT',
        message: 'Có quá nhiều dòng để xuất. Vui lòng thu hẹp bộ lọc.',
      };
    }

    const rows = await scoped.user.findMany({
      where,
      orderBy: userOrderBy(filter.sort),
      select: USER_SUMMARY_SELECT,
    });

    const base64 = await buildWorkbookBase64(
      'Tài khoản',
      USER_EXPORT_COLUMNS,
      rows.map(toUserSummary),
    );
    return { ok: true, data: { fileName: 'tai-khoan.xlsx', base64 } };
  } catch (error) {
    return toActionError(error);
  }
}
