import 'server-only';
import type { ListCheckInsInput, ListCheckInsResult } from '@seedgw/contracts/check-ins';
import { assertCan } from '@/server/auth/can';
import { requireUser } from '@/server/auth/current-user';
import { getScopedDb } from '@/server/auth/scoped-db';
import { isRoadDistanceEnabled } from '@/server/integrations/road-distance-queue';
import {
  CHECK_IN_ORDER_BY,
  CHECK_IN_ROW_SELECT,
  checkInWhere,
  toCheckInRow,
} from '@/server/services/check-in-report';

// Nhân viên chỉ thấy check-in của mình, quản lý thấy theo phạm vi dữ liệu của vai trò (V2).
export async function listCheckIns(input: ListCheckInsInput): Promise<ListCheckInsResult> {
  const [user, scoped] = await Promise.all([requireUser(), getScopedDb()]);
  assertCan(user, 'sales.check-in.read');

  const where = checkInWhere(input);
  const [rows, total, sum] = await Promise.all([
    scoped.checkIn.findMany({
      where,
      orderBy: CHECK_IN_ORDER_BY,
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
      select: CHECK_IN_ROW_SELECT,
    }),
    scoped.checkIn.count({ where }),
    scoped.checkIn.aggregate({ where, _sum: { gpsDistanceKm: true, roadDistanceKm: true } }),
  ]);

  const now = Date.now();
  return {
    items: rows.map((row) => toCheckInRow(row, now)),
    total,
    page: input.page,
    pageSize: input.pageSize,
    totalGpsDistanceKm: Math.round((sum._sum.gpsDistanceKm ?? 0) * 1000) / 1000,
    roadEnabled: isRoadDistanceEnabled(),
    totalRoadDistanceKm: Math.round((sum._sum.roadDistanceKm ?? 0) * 1000) / 1000,
  };
}
