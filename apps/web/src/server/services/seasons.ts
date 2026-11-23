import 'server-only';
import { auditChanges, type AuditChanges } from '@seedgw/contracts/audit';
import { formatDate } from '@seedgw/contracts/format';
import { seasonDays, type SeasonRow, type UpsertSeasonInput } from '@seedgw/contracts/seasons';
import { db } from '@seedgw/db/client';
import { isUniqueViolation } from './approvals';
import { DomainError } from './domain-error';

// Lịch vụ (K3): một lịch chung toàn công ty, không theo phạm vi dữ liệu. Ai đăng nhập cũng đọc được để chọn
// kỳ Vụ trên Dashboard và Báo cáo; chỉ Quản trị hệ thống sửa.

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function fromIsoDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export async function listSeasons(): Promise<SeasonRow[]> {
  const rows = await db.season.findMany({
    orderBy: [{ startDate: 'desc' }, { name: 'asc' }],
    select: { id: true, name: true, startDate: true, endDate: true, note: true },
  });
  return rows.map((row) => {
    const startDate = toIsoDate(row.startDate);
    const endDate = toIsoDate(row.endDate);
    return { ...row, startDate, endDate, days: seasonDays(startDate, endDate) };
  });
}

export type SeasonOutcome = {
  id: string;
  name: string;
  created: boolean;
  changes: AuditChanges;
};

function snapshot(row: { name: string; startDate: string; endDate: string; note: string }) {
  return {
    'Tên vụ': row.name,
    'Từ ngày': formatDate(`${row.startDate}T00:00:00+07:00`),
    'Đến ngày': formatDate(`${row.endDate}T00:00:00+07:00`),
    'Ghi chú': row.note,
  };
}

export async function upsertSeason(input: UpsertSeasonInput): Promise<SeasonOutcome> {
  const data = {
    name: input.name,
    startDate: fromIsoDate(input.startDate),
    endDate: fromIsoDate(input.endDate),
    note: input.note,
  };
  try {
    if (!input.id) {
      const created = await db.season.create({ data, select: { id: true } });
      return {
        id: created.id,
        name: input.name,
        created: true,
        changes: auditChanges({}, snapshot(input)),
      };
    }
    const before = await db.season.findUnique({
      where: { id: input.id },
      select: { name: true, startDate: true, endDate: true, note: true },
    });
    if (!before) throw new DomainError('NOT_FOUND', 'Không tìm thấy vụ, vui lòng tải lại trang');
    await db.season.update({ where: { id: input.id }, data });
    return {
      id: input.id,
      name: input.name,
      created: false,
      changes: auditChanges(
        snapshot({
          ...before,
          startDate: toIsoDate(before.startDate),
          endDate: toIsoDate(before.endDate),
        }),
        snapshot(input),
      ),
    };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new DomainError('CONFLICT', 'Đã có vụ cùng tên', { name: 'Tên vụ đã được dùng' });
    }
    throw error;
  }
}

export async function deleteSeason(id: string): Promise<{ name: string }> {
  const row = await db.season.findUnique({ where: { id }, select: { name: true } });
  if (!row) throw new DomainError('NOT_FOUND', 'Không tìm thấy vụ, vui lòng tải lại trang');
  await db.season.delete({ where: { id } });
  return row;
}
