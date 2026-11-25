import { z } from 'zod';
import { parseDisplayDate } from './format';
import { passwordPolicy } from './auth';
import {
  employeeCodeField,
  PASSWORD_HAS_EMPLOYEE_CODE,
  passwordHasEmployeeCode,
  userProfileFields,
} from './users';

export const MAX_IMPORT_ROWS = 1000;
// Thap hon gioi han 1 MB mac dinh cua Server Action.
export const MAX_IMPORT_FILE_BYTES = 900 * 1024;

export const USER_IMPORT_COLUMNS = [
  { key: 'employeeCode', header: 'Mã nhân viên (bắt buộc)', width: 24 },
  { key: 'fullName', header: 'Họ tên (bắt buộc)', width: 30 },
  { key: 'phone', header: 'Số điện thoại', width: 16 },
  { key: 'email', header: 'Email', width: 30 },
  { key: 'orgUnitCode', header: 'Mã đơn vị (bắt buộc)', width: 22 },
  { key: 'jobTitle', header: 'Chức danh', width: 26 },
  { key: 'hiredAt', header: 'Ngày vào làm (dd/mm/yyyy)', width: 26 },
  { key: 'managerCode', header: 'Mã quản lý trực tiếp', width: 22 },
  { key: 'roleCodes', header: 'Mã vai trò (bắt buộc, cách nhau bằng dấu phẩy)', width: 44 },
  { key: 'password', header: 'Mật khẩu (bắt buộc)', width: 22 },
] as const;

type ImportColumnKey = (typeof USER_IMPORT_COLUMNS)[number]['key'];

export type UserImportRaw = Record<ImportColumnKey, string> & { rowNumber: number };
export type UserImportPreviewRow = UserImportRaw & { errors: string[] };

export type UserImportPreview = {
  rows: UserImportPreviewRow[];
  validCount: number;
  errorCount: number;
};

export const commitUserImportInput = z.object({
  rows: z
    .array(
      z.object({
        rowNumber: z.number().int().positive(),
        employeeCode: z.string().max(200),
        fullName: z.string().max(500),
        phone: z.string().max(200),
        email: z.string().max(500),
        orgUnitCode: z.string().max(200),
        jobTitle: z.string().max(500),
        hiredAt: z.string().max(100),
        managerCode: z.string().max(200),
        roleCodes: z.string().max(1000),
        password: z.string().max(200),
      }),
    )
    .min(1, 'File không có dòng dữ liệu nào')
    .max(MAX_IMPORT_ROWS, `Mỗi lần chỉ nhập tối đa ${MAX_IMPORT_ROWS} dòng`),
  /** Áp cho mọi tài khoản trong file; bật thì phải đổi mật khẩu trên web trước khi dùng app. */
  mustChangePassword: z.boolean(),
});

function splitRoleCodes(value: string): string[] {
  return value
    .split(/[,;]/)
    .map((code) => code.trim().toLowerCase())
    .filter(Boolean);
}

const importRowFields = z.object({
  employeeCode: employeeCodeField,
  ...userProfileFields,
  hiredAt: z.string().trim(),
  orgUnitCode: z.string().trim().toUpperCase().min(1, 'Thiếu mã đơn vị'),
  managerCode: z.string().trim().toUpperCase(),
  roleCodes: z
    .string()
    .transform(splitRoleCodes)
    .pipe(z.array(z.string()).min(1, 'Thiếu mã vai trò')),
  password: passwordPolicy,
});

export type ParsedUserImportRow = z.infer<typeof importRowFields>;

export type UserImportLookups = {
  existingEmployeeCodes: ReadonlySet<string>;
  orgUnitCodes: ReadonlySet<string>;
  roleCodes: ReadonlySet<string>;
  managerCodes: ReadonlySet<string>;
};

// Tra ve cac ma nam tren mot vong quan ly, tinh ca truong hop tu quan ly chinh minh.
export function findManagerCycles(
  rows: ReadonlyArray<{ employeeCode: string; managerCode: string }>,
): Set<string> {
  const managerOf = new Map(rows.map((row) => [row.employeeCode, row.managerCode]));
  const inCycle = new Set<string>();

  for (const { employeeCode } of rows) {
    const path = new Set<string>();
    let current: string | undefined = employeeCode;
    while (current && managerOf.has(current) && !path.has(current)) {
      path.add(current);
      current = managerOf.get(current);
    }
    if (current === employeeCode) inCycle.add(employeeCode);
  }
  return inCycle;
}

type ValidatedRow = {
  raw: UserImportRaw;
  errors: string[];
  value: ParsedUserImportRow | null;
};

export function validateUserImportRows(
  rows: readonly UserImportRaw[],
  lookups: UserImportLookups,
): ValidatedRow[] {
  // Chuan hoa rieng voi Zod de dong sai dinh dang van duoc kiem tra du, bao het loi trong mot lan.
  const rowsWithKeys = rows.map((raw) => ({
    raw,
    result: importRowFields.safeParse(raw),
    employeeCode: raw.employeeCode.trim().toUpperCase(),
    orgUnitCode: raw.orgUnitCode.trim().toUpperCase(),
    managerCode: raw.managerCode.trim().toUpperCase(),
    roleCodes: splitRoleCodes(raw.roleCodes),
    hiredAt: raw.hiredAt.trim(),
  }));

  const countByCode = new Map<string, number>();
  for (const { employeeCode } of rowsWithKeys) {
    if (employeeCode) countByCode.set(employeeCode, (countByCode.get(employeeCode) ?? 0) + 1);
  }
  const cycles = findManagerCycles(rowsWithKeys);

  return rowsWithKeys.map((row) => {
    const { raw, result, employeeCode, orgUnitCode, managerCode } = row;
    const errors = result.success ? [] : result.error.issues.map((issue) => issue.message);

    if ((countByCode.get(employeeCode) ?? 0) > 1) {
      errors.push(`Mã nhân viên ${employeeCode} bị trùng trong file`);
    }
    if (lookups.existingEmployeeCodes.has(employeeCode)) {
      errors.push(`Mã nhân viên ${employeeCode} đã tồn tại`);
    }
    if (orgUnitCode && !lookups.orgUnitCodes.has(orgUnitCode)) {
      errors.push(`Mã đơn vị ${orgUnitCode} không tồn tại hoặc ngoài phạm vi của bạn`);
    }
    for (const code of row.roleCodes) {
      if (!lookups.roleCodes.has(code)) {
        errors.push(`Mã vai trò ${code} không tồn tại hoặc bạn không được gán`);
      }
    }
    if (managerCode && !countByCode.has(managerCode) && !lookups.managerCodes.has(managerCode)) {
      errors.push(`Mã quản lý ${managerCode} không tồn tại`);
    }
    if (passwordHasEmployeeCode(raw.password, employeeCode)) {
      errors.push(PASSWORD_HAS_EMPLOYEE_CODE);
    }
    if (cycles.has(employeeCode)) {
      errors.push('Quản lý trực tiếp tạo thành vòng lặp');
    }

    const hiredAt = row.hiredAt ? parseDisplayDate(row.hiredAt) : '';
    if (hiredAt === null) {
      errors.push(`Ngày vào làm ${row.hiredAt} không hợp lệ, cần dạng dd/mm/yyyy`);
    }

    const value =
      result.success && hiredAt !== null && errors.length === 0
        ? { ...result.data, hiredAt }
        : null;
    return { raw, errors, value };
  });
}
