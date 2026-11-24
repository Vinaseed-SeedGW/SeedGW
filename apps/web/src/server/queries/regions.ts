import 'server-only';
import type { PermissionCode } from '@seedgw/contracts/access';
import type { DayMapFilterOptions } from '@seedgw/contracts/check-ins';
import type { GeoFilterOptions, ProvinceRow, RegionOption } from '@seedgw/contracts/regions';
import { assertCan } from '@/server/auth/can';
import { requireUser } from '@/server/auth/current-user';
import {
  listProvinceRegions,
  listProvinceRows,
  listRegions,
  readGeoFilterOptions,
} from '@/server/services/regions';

/** Trang Quản trị › Vùng và tỉnh. */
export async function getProvinceRows(): Promise<ProvinceRow[]> {
  const user = await requireUser();
  assertCan(user, 'admin.region.read');
  return listProvinceRows();
}

/** Vùng cho ô chọn ở Lịch vụ, Tổng quan; ai đăng nhập cũng đọc được (danh mục chung). */
export async function getRegions(): Promise<RegionOption[]> {
  await requireUser();
  return listRegions();
}

/** Tỉnh và vùng của tỉnh, để đọc tham số URL Dashboard, Báo cáo, Tổng quan. */
export async function getProvinceRegions() {
  await requireUser();
  return listProvinceRegions();
}

/** Ô Vùng, Tỉnh, kèm tỉnh liên quan của các đơn vị đang có trong ô Đơn vị. */
export async function getGeoFilterOptions(
  people: DayMapFilterOptions,
  permission: PermissionCode,
): Promise<GeoFilterOptions> {
  const user = await requireUser();
  assertCan(user, permission);
  return readGeoFilterOptions(people.orgUnits.map((unit) => unit.id));
}
