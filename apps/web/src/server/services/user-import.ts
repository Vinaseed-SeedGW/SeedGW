import 'server-only';
import { randomUUID } from 'node:crypto';
import type { AuditChanges } from '@dms/contracts/audit';
import { auditChanges } from '@dms/contracts/audit';
import type { ExportedFile } from '@dms/contracts/common';
import {
  MAX_IMPORT_ROWS,
  USER_IMPORT_COLUMNS,
  validateUserImportRows,
  type ParsedUserImportRow,
  type UserImportPreview,
  type UserImportRaw,
} from '@dms/contracts/user-import';
import { db } from '@dms/db/client';
import type { CurrentUser } from '@/server/auth/current-user';
import { getAssignableOrgUnitIds, getScopedDb } from '@/server/auth/scoped-db';
import { generateTemporaryPassword, hashPassword } from '@/server/services/credentials';
import { DomainError } from '@/server/services/domain-error';
import {
  buildMultiSheetBase64,
  buildWorkbookBase64,
  readFirstSheet,
  sheetWriter,
} from '@/server/services/excel';
import {
  auditDate,
  dateFromInput,
  exceedsActor,
  isUniqueViolation,
  ROLE_PERMISSIONS_SELECT,
} from '@/server/services/users';

const IMPORT_TRANSACTION_TIMEOUT_MS = 60_000;

function normalizeHeader(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

// Excel tu bo so 0 dau khi o dang so, can bu lai truoc khi kiem tra.
function normalizePhone(text: string): string {
  const digits = text.replace(/[\s.-]/g, '');
  return /^[1-9]\d{8,9}$/.test(digits) ? `0${digits}` : digits;
}

export async function parseUserImportFile(data: ArrayBuffer): Promise<UserImportRaw[]> {
  const sheetRows = await readFirstSheet(data, USER_IMPORT_COLUMNS.length);
  if (!sheetRows) {
    throw new DomainError('VALIDATION', 'Không đọc được file. Vui lòng dùng file .xlsx theo mẫu.');
  }

  const [header, ...body] = sheetRows;
  const isTemplate =
    header !== undefined &&
    USER_IMPORT_COLUMNS.every(
      (column, index) =>
        normalizeHeader(header.cells[index] ?? '') === normalizeHeader(column.header),
    );
  if (!isTemplate) {
    throw new DomainError('VALIDATION', 'File không đúng mẫu. Vui lòng tải file mẫu và nhập lại.');
  }
  if (body.length === 0) {
    throw new DomainError('VALIDATION', 'File không có dòng dữ liệu nào.');
  }
  if (body.length > MAX_IMPORT_ROWS) {
    throw new DomainError('VALIDATION', `Mỗi lần chỉ nhập tối đa ${MAX_IMPORT_ROWS} dòng.`);
  }

  return body.map(({ rowNumber, cells }) => {
    const raw = { rowNumber } as UserImportRaw;
    USER_IMPORT_COLUMNS.forEach((column, index) => {
      raw[column.key] = cells[index] ?? '';
    });
    raw.phone = normalizePhone(raw.phone);
    return raw;
  });
}

async function loadLookups(actor: CurrentUser, rows: readonly UserImportRaw[]) {
  const codes = rows.map((row) => row.employeeCode.trim().toUpperCase()).filter(Boolean);
  const managerCodes = rows.map((row) => row.managerCode.trim().toUpperCase()).filter(Boolean);

  const scoped = await getScopedDb();
  const [existing, orgUnits, roles, assignableUnits, managers] = await Promise.all([
    db.user.findMany({ where: { employeeCode: { in: codes } }, select: { employeeCode: true } }),
    db.orgUnit.findMany({ select: { id: true, code: true, name: true } }),
    db.role.findMany({ select: { ...ROLE_PERMISSIONS_SELECT, code: true } }),
    getAssignableOrgUnitIds(),
    scoped.user.findMany({
      where: { employeeCode: { in: managerCodes }, isActive: true },
      select: { id: true, employeeCode: true },
    }),
  ]);

  const units = orgUnits.filter((unit) => !assignableUnits || assignableUnits.has(unit.id));
  const assignableRoles = roles.filter((role) => !exceedsActor(actor, [role]));

  return {
    lookups: {
      existingEmployeeCodes: new Set(existing.map((user) => user.employeeCode)),
      orgUnitCodes: new Set(units.map((unit) => unit.code.toUpperCase())),
      roleCodes: new Set(assignableRoles.map((role) => role.code.toLowerCase())),
      managerCodes: new Set(managers.map((manager) => manager.employeeCode)),
    },
    unitByCode: new Map(units.map((unit) => [unit.code.toUpperCase(), unit])),
    roleByCode: new Map(assignableRoles.map((role) => [role.code.toLowerCase(), role])),
    managerIdByCode: new Map(managers.map((manager) => [manager.employeeCode, manager.id])),
  };
}

export async function previewUserImport(
  actor: CurrentUser,
  rows: readonly UserImportRaw[],
): Promise<UserImportPreview> {
  const { lookups } = await loadLookups(actor, rows);
  const validated = validateUserImportRows(rows, lookups);
  const previewRows = validated.map(({ raw, errors }) => ({ ...raw, errors }));
  const errorCount = previewRows.filter((row) => row.errors.length > 0).length;
  return { rows: previewRows, validCount: previewRows.length - errorCount, errorCount };
}

type CommittedRow = {
  id: string;
  employeeCode: string;
  fullName: string;
  temporaryPassword: string;
  changes: AuditChanges;
};

type CommitOutcome = { created: CommittedRow[]; file: ExportedFile };

// Ghi tat ca hoac khong ghi gi, de nguoi dung sua file roi nhap lai ma khong bi trung ma.
export async function commitUserImport(
  actor: CurrentUser,
  rows: readonly UserImportRaw[],
): Promise<CommitOutcome> {
  const { lookups, unitByCode, roleByCode, managerIdByCode } = await loadLookups(actor, rows);
  const validated = validateUserImportRows(rows, lookups);
  const values = validated.flatMap(({ value }) => (value ? [value] : []));
  if (values.length !== rows.length) {
    throw new DomainError(
      'CONFLICT',
      'Dữ liệu đã thay đổi và có dòng lỗi. Vui lòng xem trước lại.',
    );
  }

  const prepared = await Promise.all(
    values.map(async (row) => {
      const temporaryPassword = generateTemporaryPassword();
      return {
        row,
        id: randomUUID(),
        temporaryPassword,
        passwordHash: await hashPassword(temporaryPassword),
      };
    }),
  );
  const idByCode = new Map(prepared.map(({ row, id }) => [row.employeeCode, id]));

  function resolveManagerId(row: ParsedUserImportRow): string | null {
    if (!row.managerCode) return null;
    return idByCode.get(row.managerCode) ?? managerIdByCode.get(row.managerCode) ?? null;
  }

  const reportsByManager = new Map<string, string[]>();
  for (const { row, id } of prepared) {
    const managerId = resolveManagerId(row);
    if (managerId)
      reportsByManager.set(managerId, [...(reportsByManager.get(managerId) ?? []), id]);
  }

  try {
    await db.$transaction(
      async (tx) => {
        await tx.user.createMany({
          data: prepared.map(({ row, id, passwordHash }) => ({
            id,
            employeeCode: row.employeeCode,
            fullName: row.fullName,
            phone: row.phone || null,
            email: row.email || null,
            jobTitle: row.jobTitle || null,
            hiredAt: dateFromInput(row.hiredAt),
            orgUnitId: unitByCode.get(row.orgUnitCode)?.id ?? null,
            passwordHash,
            mustChangePassword: true,
          })),
        });
        await tx.userRole.createMany({
          data: prepared.flatMap(({ row, id }) =>
            row.roleCodes.flatMap((code) => {
              const role = roleByCode.get(code);
              return role ? [{ userId: id, roleId: role.id }] : [];
            }),
          ),
          skipDuplicates: true,
        });
        // Gan quan ly sau khi da tao du nguoi vi quan ly co the nam trong cung file.
        for (const [managerId, ids] of reportsByManager) {
          await tx.user.updateMany({ where: { id: { in: ids } }, data: { managerId } });
        }
      },
      { timeout: IMPORT_TRANSACTION_TIMEOUT_MS },
    );
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new DomainError('CONFLICT', 'Có mã nhân viên vừa được tạo. Vui lòng xem trước lại.');
    }
    throw error;
  }

  const created = prepared.map(({ row, id, temporaryPassword }) => ({
    id,
    employeeCode: row.employeeCode,
    fullName: row.fullName,
    temporaryPassword,
    changes: auditChanges(
      {},
      {
        fullName: row.fullName,
        phone: row.phone || null,
        email: row.email || null,
        jobTitle: row.jobTitle || null,
        hiredAt: auditDate(row.hiredAt),
        orgUnit: unitByCode.get(row.orgUnitCode)?.name ?? null,
        directManager: row.managerCode || null,
        roles: row.roleCodes.map((code) => roleByCode.get(code)?.name ?? code).join(', '),
      },
    ),
  }));

  const base64 = await buildWorkbookBase64(
    'Mật khẩu tạm',
    [
      { header: 'Mã nhân viên', width: 18, value: (row: CommittedRow) => row.employeeCode },
      { header: 'Họ tên', width: 30, value: (row: CommittedRow) => row.fullName },
      { header: 'Mật khẩu tạm', width: 20, value: (row: CommittedRow) => row.temporaryPassword },
    ],
    created,
  );
  return { created, file: { fileName: 'mat-khau-tam.xlsx', base64 } };
}

export async function buildUserImportTemplate(actor: CurrentUser): Promise<ExportedFile> {
  const [orgUnits, roles, assignableUnits] = await Promise.all([
    db.orgUnit.findMany({ orderBy: { code: 'asc' }, select: { id: true, code: true, name: true } }),
    db.role.findMany({
      orderBy: { name: 'asc' },
      select: { ...ROLE_PERMISSIONS_SELECT, code: true },
    }),
    getAssignableOrgUnitIds(),
  ]);

  type Catalog = { code: string; name: string };
  const catalogColumns = (codeHeader: string, nameHeader: string) => [
    { header: codeHeader, width: 24, value: (row: Catalog) => row.code },
    { header: nameHeader, width: 36, value: (row: Catalog) => row.name },
  ];

  const base64 = await buildMultiSheetBase64([
    sheetWriter<never>({
      name: 'Nhân viên',
      columns: USER_IMPORT_COLUMNS.map(({ header, width }) => ({
        header,
        width,
        numberFormat: '@' as const,
        value: () => '',
      })),
      rows: [],
    }),
    sheetWriter<Catalog>({
      name: 'Mã đơn vị',
      columns: catalogColumns('Mã đơn vị', 'Tên đơn vị'),
      rows: orgUnits.filter((unit) => !assignableUnits || assignableUnits.has(unit.id)),
    }),
    sheetWriter<Catalog>({
      name: 'Mã vai trò',
      columns: catalogColumns('Mã vai trò', 'Tên vai trò'),
      rows: roles.filter((role) => !exceedsActor(actor, [role])),
    }),
  ]);
  return { fileName: 'mau-nhap-tai-khoan.xlsx', base64 };
}
