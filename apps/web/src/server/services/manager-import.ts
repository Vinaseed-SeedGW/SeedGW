import 'server-only';
import { auditChanges, type AuditChanges } from '@dms/contracts/audit';
import type { ExportedFile } from '@dms/contracts/common';
import {
  MANAGER_IMPORT_COLUMNS,
  validateManagerImportRows,
  type ManagerImportPreview,
  type ManagerImportRaw,
} from '@dms/contracts/manager-import';
import { MAX_IMPORT_ROWS } from '@dms/contracts/user-import';
import { db } from '@dms/db/client';
import { getScopedDb } from '@/server/auth/scoped-db';
import { DomainError } from '@/server/services/domain-error';
import { buildWorkbookBase64, readFirstSheet } from '@/server/services/excel';

// Cập nhật Quản lý trực tiếp hàng loạt (F3b): chỉ đổi ô này của tài khoản trong phạm vi người nhập.

function normalizeHeader(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

export async function parseManagerImportFile(data: ArrayBuffer): Promise<ManagerImportRaw[]> {
  const sheetRows = await readFirstSheet(data, MANAGER_IMPORT_COLUMNS.length);
  if (!sheetRows) {
    throw new DomainError('VALIDATION', 'Không đọc được file. Vui lòng dùng file .xlsx theo mẫu.');
  }
  const [header, ...body] = sheetRows;
  const isTemplate =
    header !== undefined &&
    MANAGER_IMPORT_COLUMNS.every(
      (column, index) =>
        normalizeHeader(header.cells[index] ?? '') === normalizeHeader(column.header),
    );
  if (!isTemplate) {
    throw new DomainError('VALIDATION', 'File không đúng mẫu. Vui lòng tải file mẫu và nhập lại.');
  }
  const rows = body.filter(({ cells }) => cells.some((cell) => cell.trim() !== ''));
  if (rows.length === 0) throw new DomainError('VALIDATION', 'File không có dòng dữ liệu nào.');
  if (rows.length > MAX_IMPORT_ROWS) {
    throw new DomainError('VALIDATION', `Mỗi lần chỉ nhập tối đa ${MAX_IMPORT_ROWS} dòng.`);
  }
  return rows.map(({ rowNumber, cells }) => ({
    rowNumber,
    employeeCode: cells[0] ?? '',
    fullName: cells[1] ?? '',
    managerCode: cells[2] ?? '',
  }));
}

async function loadLookups() {
  const scoped = await getScopedDb();
  const [inScope, everyone] = await Promise.all([
    scoped.user.findMany({ where: { isActive: true }, select: { employeeCode: true } }),
    db.user.findMany({
      where: { isActive: true },
      select: { employeeCode: true, manager: { select: { employeeCode: true } } },
    }),
  ]);
  return {
    inScope: new Set(inScope.map((user) => user.employeeCode)),
    activeCodes: new Set(everyone.map((user) => user.employeeCode)),
    currentManagerOf: new Map(
      everyone.flatMap((user) =>
        user.manager ? [[user.employeeCode, user.manager.employeeCode] as const] : [],
      ),
    ),
  };
}

export async function previewManagerImport(
  rows: readonly ManagerImportRaw[],
): Promise<ManagerImportPreview> {
  const validated = validateManagerImportRows(rows, await loadLookups());
  return {
    rows: validated,
    changedCount: validated.filter((row) => row.errors.length === 0 && row.changed).length,
    errorCount: validated.filter((row) => row.errors.length > 0).length,
  };
}

export type ManagerChange = { id: string; employeeCode: string; changes: AuditChanges };

/** Ghi trong một giao dịch; còn dòng lỗi thì không ghi dòng nào. */
export async function commitManagerImport(
  rows: readonly ManagerImportRaw[],
): Promise<ManagerChange[]> {
  const validated = validateManagerImportRows(rows, await loadLookups());
  if (validated.some((row) => row.errors.length > 0)) {
    throw new DomainError('VALIDATION', 'File còn dòng lỗi. Vui lòng sửa và xem trước lại.');
  }
  const changed = validated.filter((row) => row.changed);
  if (changed.length === 0) return [];

  const codes = [...new Set(changed.flatMap((row) => [row.employeeCode, row.managerCode]))];
  const users = await db.user.findMany({
    where: { employeeCode: { in: codes.filter(Boolean) } },
    select: { id: true, employeeCode: true, fullName: true },
  });
  const byCode = new Map(users.map((user) => [user.employeeCode, user]));
  const label = (code: string) => {
    const user = byCode.get(code);
    return user ? `${user.employeeCode} ${user.fullName}` : null;
  };
  // Phạm vi đã kiểm ở bước xác thực (mã nhân viên phải nằm trong phạm vi người nhập).
  return db.$transaction(async (tx) => {
    const results: ManagerChange[] = [];
    for (const row of changed) {
      const employee = byCode.get(row.employeeCode);
      if (!employee) continue;
      await tx.user.update({
        where: { id: employee.id },
        data: { managerId: row.managerCode ? (byCode.get(row.managerCode)?.id ?? null) : null },
      });
      results.push({
        id: employee.id,
        employeeCode: employee.employeeCode,
        changes: auditChanges(
          { 'Quản lý trực tiếp': row.currentManagerCode ? label(row.currentManagerCode) : null },
          { 'Quản lý trực tiếp': row.managerCode ? label(row.managerCode) : null },
        ),
      });
    }
    return results;
  });
}

/** File mẫu điền sẵn nhân viên đang hoạt động trong phạm vi và quản lý hiện tại. */
export async function buildManagerImportTemplate(): Promise<ExportedFile> {
  const scoped = await getScopedDb();
  const users = await scoped.user.findMany({
    where: { isActive: true },
    orderBy: { employeeCode: 'asc' },
    select: { employeeCode: true, fullName: true, manager: { select: { employeeCode: true } } },
  });
  const [code, name, manager] = MANAGER_IMPORT_COLUMNS;
  const base64 = await buildWorkbookBase64(
    'Quản lý trực tiếp',
    [
      {
        header: code.header,
        width: code.width,
        numberFormat: '@',
        value: (row) => row.employeeCode,
      },
      { header: name.header, width: name.width, value: (row) => row.fullName },
      {
        header: manager.header,
        width: manager.width,
        numberFormat: '@',
        value: (row) => row.manager?.employeeCode ?? '',
      },
    ],
    users,
  );
  return { fileName: 'cap-nhat-quan-ly-truc-tiep.xlsx', base64 };
}
