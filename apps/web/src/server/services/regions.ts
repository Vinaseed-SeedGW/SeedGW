import 'server-only';
import { auditChanges, type AuditChanges } from '@seedgw/contracts/audit';
import { collectDescendantIds } from '@seedgw/contracts/org-tree';
import { PROVINCES, type ProvinceName } from '@seedgw/contracts/provinces';
import {
  selectedProvinces,
  type GeoFilterOptions,
  type ProvinceRow,
  type RegionOption,
  type SetProvinceRegionInput,
} from '@seedgw/contracts/regions';
import { db } from '@seedgw/db/client';
import { DomainError } from './domain-error';

// Vùng và tỉnh (K7): danh mục chung toàn công ty như Lịch vụ, không theo phạm vi dữ liệu.

export async function listRegions(): Promise<RegionOption[]> {
  return db.region.findMany({ orderBy: { sortOrder: 'asc' }, select: { id: true, name: true } });
}

function isProvince(name: string): name is ProvinceName {
  return (PROVINCES as readonly string[]).includes(name);
}

export async function listProvinceRegions(): Promise<
  { name: ProvinceName; regionId: string | null }[]
> {
  const rows = await db.provinceRegion.findMany({ select: { provinceName: true, regionId: true } });
  const regionOf = new Map(rows.map((row) => [row.provinceName, row.regionId]));
  return PROVINCES.map((name) => ({ name, regionId: regionOf.get(name) ?? null }));
}

/** 34 tỉnh cho trang Quản trị › Vùng và tỉnh: vùng, số đại lý đang hoạt động, đơn vị phụ trách. */
export async function listProvinceRows(): Promise<ProvinceRow[]> {
  const [regions, dealers, units] = await Promise.all([
    listProvinceRegions(),
    db.dealer.groupBy({
      by: ['provinceName'],
      where: { status: 'ACTIVE', provinceName: { not: null } },
      _count: { _all: true },
    }),
    db.orgUnitProvince.findMany({
      orderBy: { orgUnit: { name: 'asc' } },
      select: { provinceName: true, orgUnit: { select: { name: true } } },
    }),
  ]);
  const dealerCount = new Map(dealers.map((row) => [row.provinceName, row._count._all]));
  const unitNames = new Map<string, string[]>();
  for (const row of units) {
    unitNames.set(row.provinceName, [...(unitNames.get(row.provinceName) ?? []), row.orgUnit.name]);
  }
  return regions.map((row) => ({
    ...row,
    dealerCount: dealerCount.get(row.name) ?? 0,
    orgUnitNames: unitNames.get(row.name) ?? [],
  }));
}

export async function setProvinceRegion(
  input: SetProvinceRegionInput,
): Promise<{ changes: AuditChanges }> {
  const [region, current] = await Promise.all([
    db.region.findUnique({ where: { id: input.regionId }, select: { name: true } }),
    db.provinceRegion.findUnique({
      where: { provinceName: input.provinceName },
      select: { region: { select: { name: true } } },
    }),
  ]);
  if (!region) throw new DomainError('NOT_FOUND', 'Không tìm thấy vùng, vui lòng tải lại trang');
  await db.provinceRegion.upsert({
    where: { provinceName: input.provinceName },
    update: { regionId: input.regionId },
    create: { provinceName: input.provinceName, regionId: input.regionId },
  });
  return {
    changes: auditChanges({ Vùng: current?.region.name ?? null }, { Vùng: region.name }),
  };
}

/** Ô Vùng, Tỉnh và tỉnh liên quan của từng đơn vị trong ô Đơn vị. */
export async function readGeoFilterOptions(unitIds: readonly string[]): Promise<GeoFilterOptions> {
  const [regions, provinces, units, links] = await Promise.all([
    listRegions(),
    listProvinceRegions(),
    db.orgUnit.findMany({ select: { id: true, parentId: true } }),
    db.orgUnitProvince.findMany({ select: { orgUnitId: true, provinceName: true } }),
  ]);
  const own = new Map<string, Set<ProvinceName>>();
  for (const link of links) {
    if (!isProvince(link.provinceName)) continue;
    own.set(link.orgUnitId, (own.get(link.orgUnitId) ?? new Set()).add(link.provinceName));
  }
  const parentOf = new Map(units.map((unit) => [unit.id, unit.parentId]));
  const unitProvinces: Record<string, ProvinceName[]> = {};
  for (const id of unitIds) {
    const related = new Set<ProvinceName>();
    const add = (unitId: string) => own.get(unitId)?.forEach((name) => related.add(name));
    add(id);
    collectDescendantIds(units, id).forEach(add);
    for (let at = parentOf.get(id) ?? null; at; at = parentOf.get(at) ?? null) add(at);
    unitProvinces[id] = PROVINCES.filter((name) => related.has(name));
  }
  return { regions, provinces, unitProvinces };
}

export type ProvinceFilter = {
  provinces: ProvinceName[];
  // Đơn vị phụ trách các tỉnh này và đơn vị con: nhân viên của các đơn vị này là người đi tỉnh đó.
  staffUnitIds: string[];
  // Thêm đơn vị cha, để bảng theo đơn vị hiện cả dòng tổng.
  relatedUnitIds: Set<string>;
};

/** Tỉnh đang lọc trên Dashboard, Báo cáo, Tổng quan; null khi không lọc vùng, tỉnh. */
export async function readProvinceFilter(input: {
  regionId: string | null;
  provinceName: ProvinceName | null;
}): Promise<ProvinceFilter | null> {
  if (!input.regionId && !input.provinceName) return null;
  const provinces = selectedProvinces(input, await listProvinceRegions()) ?? [];
  const [units, links] = await Promise.all([
    db.orgUnit.findMany({ select: { id: true, parentId: true } }),
    db.orgUnitProvince.findMany({
      where: { provinceName: { in: provinces } },
      select: { orgUnitId: true },
    }),
  ]);
  const staff = new Set<string>();
  for (const { orgUnitId } of links) {
    staff.add(orgUnitId);
    collectDescendantIds(units, orgUnitId).forEach((id) => staff.add(id));
  }
  const parentOf = new Map(units.map((unit) => [unit.id, unit.parentId]));
  const related = new Set(staff);
  for (const id of staff) {
    for (let at = parentOf.get(id) ?? null; at; at = parentOf.get(at) ?? null) related.add(at);
  }
  return { provinces, staffUnitIds: [...staff], relatedUnitIds: related };
}

/** K7b: đơn vị phụ trách từng tỉnh, để gợi ý đơn vị cho đại lý mới. */
export async function readProvinceUnits(): Promise<Partial<Record<ProvinceName, string[]>>> {
  const links = await db.orgUnitProvince.findMany({
    select: { orgUnitId: true, provinceName: true },
  });
  const result: Partial<Record<ProvinceName, string[]>> = {};
  for (const link of links) {
    if (!isProvince(link.provinceName)) continue;
    result[link.provinceName] = [...(result[link.provinceName] ?? []), link.orgUnitId];
  }
  return result;
}

/**
 * K7b: địa bàn của từng đơn vị để soát đại lý ngoài địa bàn: tỉnh phụ trách của chính đơn vị, chưa khai báo thì
 * lấy của đơn vị cha gần nhất. Đơn vị không có địa bàn (cả các cấp trên chưa khai báo) thì không có trong kết quả.
 */
export async function readUnitAreas(): Promise<Map<string, ProvinceName[]>> {
  const [units, links] = await Promise.all([
    db.orgUnit.findMany({ select: { id: true, parentId: true } }),
    db.orgUnitProvince.findMany({ select: { orgUnitId: true, provinceName: true } }),
  ]);
  const own = new Map<string, ProvinceName[]>();
  for (const link of links) {
    if (!isProvince(link.provinceName)) continue;
    own.set(link.orgUnitId, [...(own.get(link.orgUnitId) ?? []), link.provinceName]);
  }
  const parentOf = new Map(units.map((unit) => [unit.id, unit.parentId]));
  const areas = new Map<string, ProvinceName[]>();
  for (const unit of units) {
    for (let at: string | null = unit.id; at; at = parentOf.get(at) ?? null) {
      const provinces = own.get(at);
      if (provinces) {
        areas.set(unit.id, provinces);
        break;
      }
    }
  }
  return areas;
}
