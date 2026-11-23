import { z } from 'zod';
import { salesTargetMonth, shiftMonth, currentVnMonth } from './sales-targets';

// Giao chỉ tiêu từ trên xuống (K3, 23/11/2026). Lãnh đạo đơn vị hoặc Quản trị hệ thống giao chỉ tiêu tháng cho
// đơn vị và nhân viên. Chỉ tiêu được giao là chỉ tiêu chính; nhân viên chưa được giao thì tự đăng ký (K3a).
// Thực bán (kg) ẩn tới khi nối FAST.

export const targetAssigneeKind = z.enum(['UNIT', 'USER']);
export type TargetAssigneeKind = z.infer<typeof targetAssigneeKind>;

const count = (label: string) =>
  z.coerce
    .number<number>({ error: `Nhập ${label}` })
    .int('Nhập số nguyên')
    .min(0, `${label[0]?.toUpperCase()}${label.slice(1)} từ 0 trở lên`)
    .max(1_000_000, 'Số quá lớn');

export const assignTargetInput = z.object({
  month: salesTargetMonth,
  kind: targetAssigneeKind,
  // Đơn vị (kind UNIT) hoặc nhân viên (kind USER).
  assigneeId: z.uuid(),
  visitCountTarget: count('số lượt ghé thăm'),
  dealerCoverageTarget: count('số đại lý được ghé'),
  note: z.string().trim().max(500, 'Ghi chú tối đa 500 ký tự'),
});
export type AssignTargetInput = z.infer<typeof assignTargetInput>;

export const removeTargetInput = z.object({ id: z.uuid() });

/** Một dòng ở tab Giao chỉ tiêu: đơn vị hoặc nhân viên trong phạm vi, kèm chỉ tiêu đã giao và kết quả. */
export const assignmentRow = z.object({
  kind: targetAssigneeKind,
  assigneeId: z.uuid(),
  code: z.string(),
  name: z.string(),
  orgUnitName: z.string().nullable(),
  assignment: z
    .object({
      id: z.uuid(),
      visitCountTarget: z.number().int(),
      dealerCoverageTarget: z.number().int(),
      note: z.string(),
      assignedByName: z.string(),
      updatedAt: z.iso.datetime(),
    })
    .nullable(),
  // Chỉ tiêu nhân viên tự đăng ký và đã duyệt, khi chưa được giao.
  selfTarget: z
    .object({ visitCountTarget: z.number().int(), dealerCoverageTarget: z.number().int() })
    .nullable(),
  progress: z.object({ visitCount: z.number().int(), dealerCoverage: z.number().int() }),
});
export type AssignmentRow = z.infer<typeof assignmentRow>;

export type AssignmentsResult = {
  month: string;
  units: AssignmentRow[];
  users: AssignmentRow[];
};

export const ASSIGN_MONTH_COUNT = 3;

/** Tháng được giao hoặc sửa: tháng này và 2 tháng sau. Tháng đã qua chỉ xem. */
export function assignableMonths(now = Date.now()): string[] {
  const current = currentVnMonth(now);
  return Array.from({ length: ASSIGN_MONTH_COUNT }, (_, index) => shiftMonth(current, index));
}

export const assignmentsUrlParams = z.object({
  thang: salesTargetMonth.optional().catch(undefined),
});

// ---------- Chỉ tiêu hiệu lực ----------

export type TargetValues = { visitCountTarget: number; dealerCoverageTarget: number };
export type TargetSource = 'ASSIGNED' | 'SELF' | 'SUM';

export const TARGET_SOURCE_LABEL: Record<TargetSource, string> = {
  ASSIGNED: 'Được giao',
  SELF: 'Tự đăng ký',
  SUM: 'Tổng chỉ tiêu nhân viên',
};

/** Nhân viên: chỉ tiêu được giao thay chỉ tiêu tự đăng ký. */
export function effectiveUserTarget(
  assigned: TargetValues | null,
  self: TargetValues | null,
): (TargetValues & { source: TargetSource }) | null {
  if (assigned) return { ...assigned, source: 'ASSIGNED' };
  if (self) return { ...self, source: 'SELF' };
  return null;
}

/**
 * Đơn vị: chỉ tiêu giao cho đơn vị; chưa giao thì cộng chỉ tiêu hiệu lực của nhân viên trong đơn vị. Số đại lý
 * được ghé cộng theo người nên có thể lớn hơn số đại lý khác nhau thực tế khi hai người ghé chung đại lý.
 */
export function effectiveUnitTarget(
  assigned: TargetValues | null,
  members: ReadonlyArray<TargetValues | null>,
): (TargetValues & { source: TargetSource }) | null {
  if (assigned) return { ...assigned, source: 'ASSIGNED' };
  const known = members.filter((value): value is TargetValues => value !== null);
  if (known.length === 0) return null;
  return {
    visitCountTarget: known.reduce((sum, value) => sum + value.visitCountTarget, 0),
    dealerCoverageTarget: known.reduce((sum, value) => sum + value.dealerCoverageTarget, 0),
    source: 'SUM',
  };
}

// ---------- Nhập Excel ----------

export const TARGET_IMPORT_COLUMNS = [
  'Tháng (mm/yyyy)',
  'Loại (Đơn vị hoặc Nhân viên)',
  'Mã đơn vị hoặc mã nhân viên',
  'Tên (để đối chiếu, không bắt buộc)',
  'Lượt ghé thăm',
  'Số đại lý được ghé',
  'Ghi chú',
] as const;

export const MAX_TARGET_IMPORT_ROWS = 2_000;

/** "11/2026" hoặc "2026-11" thành "2026-11". */
export function parseImportMonth(text: string): string | null {
  const value = text.trim();
  const vn = /^(\d{1,2})\/(\d{4})$/.exec(value);
  if (vn?.[1] && vn[2]) {
    const month = Number(vn[1]);
    return month >= 1 && month <= 12 ? `${vn[2]}-${String(month).padStart(2, '0')}` : null;
  }
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : null;
}

export function parseImportKind(text: string): TargetAssigneeKind | null {
  const value = text.trim().toLowerCase();
  if (value === 'đơn vị' || value === 'don vi') return 'UNIT';
  if (value === 'nhân viên' || value === 'nhan vien') return 'USER';
  return null;
}

export type TargetImportResult = { applied: number; errors: { row: number; message: string }[] };
