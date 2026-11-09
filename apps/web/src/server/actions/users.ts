'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { MAX_EXPORT_ROWS, type ActionResult, type ExportedFile } from '@dms/contracts/common';
import { formatDate } from '@dms/contracts/format';
import { exportUsersInput, updateUserInput, type UserSummary } from '@dms/contracts/users';
import { toActionError, validationError } from '@/server/auth/action-error';
import { assertCan } from '@/server/auth/can';
import { requireUser } from '@/server/auth/current-user';
import { getScopedDb } from '@/server/auth/scoped-db';
import { USER_SUMMARY_SELECT, toUserSummary, userOrderBy, userWhere } from '@/server/queries/users';
import { getClientIp, writeAudit } from '@/server/services/audit';
import { buildWorkbookBase64, type ExcelColumn } from '@/server/services/excel';
import { updateUser } from '@/server/services/users';

const USER_EXPORT_COLUMNS: ReadonlyArray<ExcelColumn<UserSummary>> = [
  { header: 'Mã nhân viên', width: 16, value: (row) => row.employeeCode },
  { header: 'Họ tên', width: 30, value: (row) => row.fullName },
  { header: 'Đơn vị', width: 24, value: (row) => row.orgUnitName ?? '' },
  { header: 'Vai trò', width: 30, value: (row) => row.roleNames.join(', ') },
  {
    header: 'Trạng thái',
    width: 14,
    value: (row) => (row.status === 'ACTIVE' ? 'Hoạt động' : 'Đã khoá'),
  },
  { header: 'Ngày tạo', width: 14, value: (row) => formatDate(row.createdAt) },
];

export async function updateUserAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    assertCan(user, 'admin.user.manage');

    const parsed = updateUserInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);
    const input = parsed.data;

    if (input.id === user.id && !input.isActive) {
      return {
        ok: false,
        code: 'CONFLICT',
        message: 'Không thể tự khoá tài khoản của chính mình',
        fieldErrors: { isActive: 'Không thể tự khoá tài khoản của chính mình' },
      };
    }

    const [outcome, ip] = await Promise.all([updateUser(input), getClientIp()]);
    if (!outcome) {
      return { ok: false, code: 'NOT_FOUND', message: 'Không tìm thấy tài khoản này' };
    }

    if (Object.keys(outcome.changes).length > 0) {
      after(() =>
        writeAudit({
          actorId: user.id,
          action: 'user.update',
          entityType: 'User',
          entityId: input.id,
          entityLabel: outcome.employeeCode,
          changes: outcome.changes,
          ip,
        }),
      );
      revalidatePath('/quan-tri/tai-khoan', 'layout');
    }
    return { ok: true, data: { id: input.id } };
  } catch (error) {
    return toActionError(error);
  }
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
