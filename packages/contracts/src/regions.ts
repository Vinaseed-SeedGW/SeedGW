import { z } from 'zod';
import { PROVINCES, type ProvinceName } from './provinces';
import { normalizeSearchText } from './text';

// Vùng và tỉnh (K7, 23/11/2026). Vùng là vùng canh tác (Đồng bằng sông Hồng, Tây Nguyên...), khác Miền, Vùng,
// Khu vực trong cơ cấu tổ chức (đó là Đơn vị). Mỗi tỉnh mới thuộc một vùng; tỉnh mới gộp từ tỉnh cũ ở hai vùng
// (Gia Lai gồm Bình Định...) xếp theo phần trồng lúa chính, Quản trị hệ thống đổi được. Một đơn vị phụ trách
// nhiều tỉnh, một tỉnh có nhiều đơn vị. Lọc theo tỉnh, vùng tính theo tỉnh của đại lý.

export const provinceName = z.enum(PROVINCES);

/** Tỉnh trên URL viết không dấu, bỏ chữ Tỉnh, Thành phố: "Thành phố Hồ Chí Minh" thành "ho-chi-minh". */
export function provinceSlug(name: ProvinceName): string {
  return normalizeSearchText(name)
    .replace(/^(tinh|thanh pho)\s+/, '')
    .replace(/\s+/g, '-');
}

const SLUG_TO_PROVINCE = new Map(PROVINCES.map((name) => [provinceSlug(name), name]));

export function provinceFromSlug(slug: string): ProvinceName | null {
  return SLUG_TO_PROVINCE.get(slug.trim().toLowerCase()) ?? null;
}

/** Tên ngắn trên ô chọn và bảng: bỏ chữ Tỉnh, đổi Thành phố thành TP. */
export function shortProvinceName(name: ProvinceName): string {
  return name.replace(/^Tỉnh /, '').replace(/^Thành phố /, 'TP ');
}

/** Danh sách tỉnh bỏ trùng, theo thứ tự trong PROVINCES. */
export const provinceListInput = z
  .array(provinceName)
  .max(PROVINCES.length)
  .transform((list) => PROVINCES.filter((name) => list.includes(name)));

export type RegionOption = { id: string; name: string };

export type ProvinceRow = {
  name: ProvinceName;
  regionId: string | null;
  dealerCount: number;
  orgUnitNames: string[];
};

export const setProvinceRegionInput = z.object({
  provinceName,
  regionId: z.uuid('Chọn vùng'),
});
export type SetProvinceRegionInput = z.infer<typeof setProvinceRegionInput>;

/** Dữ liệu cho ô Vùng, Tỉnh trên Dashboard, Báo cáo, Tổng quan. */
export type GeoFilterOptions = {
  regions: RegionOption[];
  provinces: { name: ProvinceName; regionId: string | null }[];
  // Mỗi đơn vị trong ô Đơn vị: các tỉnh mà đơn vị, đơn vị cha hoặc đơn vị con phụ trách, để ô Đơn vị chỉ hiện
  // đơn vị liên quan tới tỉnh, vùng đang chọn.
  unitProvinces: Record<string, ProvinceName[]>;
};

/**
 * K7b: đơn vị gợi ý cho đại lý mới. Tỉnh chỉ có một đơn vị phụ trách (trong các đơn vị người dùng chọn được)
 * thì lấy đơn vị đó; nhiều hoặc không có thì giữ đơn vị mặc định.
 */
export function suggestOrgUnit(
  responsible: readonly string[] | undefined,
  allowed: readonly string[],
  fallback: string,
): string {
  const fits = (responsible ?? []).filter((id) => allowed.includes(id));
  return fits.length === 1 && fits[0] ? fits[0] : fallback;
}

/** Tỉnh đang lọc: chọn tỉnh thì một tỉnh, chọn vùng thì các tỉnh của vùng, không chọn thì null. */
export function selectedProvinces(
  filter: { regionId: string | null; provinceName: ProvinceName | null },
  provinces: ReadonlyArray<{ name: ProvinceName; regionId: string | null }>,
): ProvinceName[] | null {
  if (filter.provinceName) return [filter.provinceName];
  if (filter.regionId) {
    return provinces.filter((row) => row.regionId === filter.regionId).map((row) => row.name);
  }
  return null;
}
