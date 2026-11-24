import 'server-only';
import { auditChanges, type AuditChanges } from '@seedgw/contracts/audit';
import {
  crossesYear,
  seasonDays,
  seasonRangeText,
  type SeasonDates,
  type SeasonRow,
  type UpsertSeasonInput,
} from '@seedgw/contracts/seasons';
import { db } from '@seedgw/db/client';
import { isUniqueViolation } from './approvals';
import { DomainError } from './domain-error';

// Lịch vụ (K3): một lịch chung toàn công ty, lặp lại mọi năm, không theo phạm vi dữ liệu. Ai đăng nhập cũng đọc
// được để chọn kỳ Vụ trên Dashboard và Báo cáo; chỉ Quản trị hệ thống sửa.

const SELECT = {
  id: true,
  name: true,
  startDay: true,
  startMonth: true,
  endDay: true,
  endMonth: true,
  regionId: true,
  region: { select: { name: true } },
  note: true,
} as const;

export async function listSeasons(): Promise<SeasonRow[]> {
  const rows = await db.season.findMany({
    orderBy: [{ startMonth: 'asc' }, { startDay: 'asc' }, { name: 'asc' }],
    select: SELECT,
  });
  return rows.map(({ region, ...row }) => ({
    ...row,
    regionName: region?.name ?? null,
    days: seasonDays(row),
    crossesYear: crossesYear(row),
  }));
}

export type SeasonOutcome = {
  id: string;
  name: string;
  created: boolean;
  changes: AuditChanges;
};

function snapshot(row: SeasonDates & { name: string; note: string; regionName: string | null }) {
  return {
    'Tên vụ': row.name,
    Vùng: row.regionName,
    'Thời gian': seasonRangeText(row),
    'Ghi chú': row.note,
  };
}

async function regionNameOf(regionId: string | null): Promise<string | null> {
  if (!regionId) return null;
  const region = await db.region.findUnique({ where: { id: regionId }, select: { name: true } });
  if (!region) {
    throw new DomainError('VALIDATION', 'Vùng không hợp lệ', {
      regionId: 'Không tìm thấy vùng, vui lòng tải lại trang',
    });
  }
  return region.name;
}

export async function upsertSeason(input: UpsertSeasonInput): Promise<SeasonOutcome> {
  const data = {
    name: input.name,
    startDay: input.startDay,
    startMonth: input.startMonth,
    endDay: input.endDay,
    endMonth: input.endMonth,
    regionId: input.regionId,
    note: input.note,
  };
  const regionName = await regionNameOf(input.regionId);
  try {
    if (!input.id) {
      const created = await db.season.create({ data, select: { id: true } });
      return {
        id: created.id,
        name: input.name,
        created: true,
        changes: auditChanges({}, snapshot({ ...data, regionName })),
      };
    }
    const before = await db.season.findUnique({ where: { id: input.id }, select: SELECT });
    if (!before) throw new DomainError('NOT_FOUND', 'Không tìm thấy vụ, vui lòng tải lại trang');
    await db.season.update({ where: { id: input.id }, data });
    return {
      id: input.id,
      name: input.name,
      created: false,
      changes: auditChanges(
        snapshot({ ...before, regionName: before.region?.name ?? null }),
        snapshot({ ...data, regionName }),
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
