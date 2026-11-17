import 'server-only';
import type { DayMapFilterOptions } from '@dms/contracts/check-ins';
import type { DashboardInput, DashboardResult } from '@dms/contracts/dashboard';
import { assertCan } from '@/server/auth/can';
import { requireUser } from '@/server/auth/current-user';
import { getPeopleFilterOptions } from '@/server/queries/people-filters';
import { readDashboard } from '@/server/services/dashboard';

// Dashboard check-in (K0): số liệu theo phạm vi dữ liệu của người xem. Cán bộ nhân viên thấy số của mình,
// không có phần xếp hạng nhân viên; Quản trị đơn vị thấy đơn vị và đơn vị con; Quản trị hệ thống thấy tất cả.
export async function getDashboard(input: DashboardInput): Promise<DashboardResult> {
  const user = await requireUser();
  assertCan(user, 'sales.dashboard.read');
  return readDashboard(input, user.dataScope !== 'OWN');
}

export function getDashboardFilterOptions(orgUnitId: string | null): Promise<DayMapFilterOptions> {
  return getPeopleFilterOptions(orgUnitId, 'sales.dashboard.read');
}
