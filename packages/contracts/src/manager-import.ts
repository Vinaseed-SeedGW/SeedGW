import { z } from 'zod';
import { findManagerCycles, MAX_IMPORT_ROWS } from './user-import';

// Cập nhật Quản lý trực tiếp hàng loạt cho tài khoản đã có (F3b). File mẫu điền sẵn nhân viên trong phạm vi
// và quản lý hiện tại; chỉ đọc cột mã nhân viên và mã quản lý, cột họ tên để tham khảo.

export const MANAGER_IMPORT_COLUMNS = [
  { key: 'employeeCode', header: 'Mã nhân viên (bắt buộc)', width: 24 },
  { key: 'fullName', header: 'Họ tên (chỉ để tham khảo)', width: 32 },
  { key: 'managerCode', header: 'Mã quản lý trực tiếp (để trống là bỏ quản lý)', width: 40 },
] as const;

export type ManagerImportRaw = {
  rowNumber: number;
  employeeCode: string;
  fullName: string;
  managerCode: string;
};

export type ManagerImportPreviewRow = ManagerImportRaw & {
  currentManagerCode: string;
  changed: boolean;
  errors: string[];
};

export type ManagerImportPreview = {
  rows: ManagerImportPreviewRow[];
  changedCount: number;
  errorCount: number;
};

export const commitManagerImportInput = z.object({
  rows: z
    .array(
      z.object({
        rowNumber: z.number().int().positive(),
        employeeCode: z.string().max(200),
        fullName: z.string().max(500),
        managerCode: z.string().max(200),
      }),
    )
    .min(1, 'File không có dòng dữ liệu nào')
    .max(MAX_IMPORT_ROWS, `Mỗi lần chỉ nhập tối đa ${MAX_IMPORT_ROWS} dòng`),
});

export type ManagerImportLookups = {
  /** Nhân viên đang hoạt động trong phạm vi người nhập, theo mã. */
  inScope: ReadonlySet<string>;
  /** Mọi mã nhân viên đang hoạt động (quản lý có thể ở đơn vị cha, ngoài phạm vi người nhập). */
  activeCodes: ReadonlySet<string>;
  /** Quản lý trực tiếp hiện tại của mọi nhân viên, để kiểm tra vòng quản lý sau khi đổi. */
  currentManagerOf: ReadonlyMap<string, string>;
};

const normalize = (value: string) => value.trim().toUpperCase();

export function validateManagerImportRows(
  rows: readonly ManagerImportRaw[],
  lookups: ManagerImportLookups,
): ManagerImportPreviewRow[] {
  const countByCode = new Map<string, number>();
  for (const row of rows) {
    const code = normalize(row.employeeCode);
    if (code) countByCode.set(code, (countByCode.get(code) ?? 0) + 1);
  }

  // Vòng quản lý tính trên quan hệ sau khi áp file: quan hệ hiện tại, ghi đè bằng dòng trong file.
  const managerOf = new Map(lookups.currentManagerOf);
  for (const row of rows) {
    const code = normalize(row.employeeCode);
    const manager = normalize(row.managerCode);
    if (!code) continue;
    if (manager) managerOf.set(code, manager);
    else managerOf.delete(code);
  }
  const cycles = findManagerCycles(
    [...managerOf].map(([employeeCode, managerCode]) => ({ employeeCode, managerCode })),
  );

  return rows.map((row) => {
    const employeeCode = normalize(row.employeeCode);
    const managerCode = normalize(row.managerCode);
    const currentManagerCode = lookups.currentManagerOf.get(employeeCode) ?? '';
    const errors: string[] = [];

    if (!employeeCode) errors.push('Thiếu mã nhân viên');
    else if (!lookups.inScope.has(employeeCode)) {
      errors.push(`Mã nhân viên ${employeeCode} không có, đã khoá hoặc ngoài phạm vi của bạn`);
    }
    if ((countByCode.get(employeeCode) ?? 0) > 1) {
      errors.push(`Mã nhân viên ${employeeCode} bị trùng trong file`);
    }
    if (managerCode && managerCode === employeeCode) {
      errors.push('Nhân viên không làm quản lý của chính mình');
    } else if (managerCode && !lookups.activeCodes.has(managerCode)) {
      errors.push(`Mã quản lý ${managerCode} không có hoặc đã khoá`);
    } else if (employeeCode && cycles.has(employeeCode)) {
      errors.push('Tạo thành vòng quản lý (A quản lý B, B lại quản lý A)');
    }

    return {
      ...row,
      employeeCode,
      managerCode,
      currentManagerCode,
      changed: managerCode !== currentManagerCode,
      errors,
    };
  });
}
