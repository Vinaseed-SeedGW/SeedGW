import 'server-only';
import type { DayMapFilterOptions, DayMapInput, DayMapResult } from '@seedgw/contracts/check-ins';
import { assertCan } from '@/server/auth/can';
import { requireUser } from '@/server/auth/current-user';
import { getPeopleFilterOptions } from '@/server/queries/people-filters';
import { readDayMap } from '@/server/services/day-map';

// Bản đồ hành trình (V2b): người xem chỉ thấy nhân viên trong phạm vi dữ liệu của mình.
export async function getDayMap(input: DayMapInput): Promise<DayMapResult | null> {
  const user = await requireUser();
  assertCan(user, 'sales.check-in.read');
  if (!input.employeeCode) return null;
  return readDayMap(input.employeeCode, input.day);
}

/** Đơn vị và nhân viên cho bộ lọc. Nhân viên chỉ thấy chính mình. */
export function getDayMapFilterOptions(orgUnitId: string | null): Promise<DayMapFilterOptions> {
  return getPeopleFilterOptions(orgUnitId, 'sales.check-in.read');
}
