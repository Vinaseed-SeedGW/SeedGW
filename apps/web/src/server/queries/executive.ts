import 'server-only';
import type { DashboardInput, DashboardResult } from '@seedgw/contracts/dashboard';
import type { UnitReportRow } from '@seedgw/contracts/reports';
import { assertCan } from '@/server/auth/can';
import { requireUser } from '@/server/auth/current-user';
import { getScopedDb } from '@/server/auth/scoped-db';
import { readDashboard } from '@/server/services/dashboard';
import { readReport } from '@/server/services/reports';
import { overdueWhere } from '@/server/services/support';

// Tổng quan điều hành (K6, IA §3.3): một màn hình cho Quản trị hệ thống và Lãnh đạo đơn vị, trong phạm vi
// dữ liệu của người xem. Dùng lại số liệu Dashboard và Báo cáo theo đơn vị. Thực bán, công nợ khi nối FAST.

export type ExecutiveOverview = {
  dashboard: DashboardResult;
  units: UnitReportRow[];
  supportOverdue: number;
};

export async function getExecutiveOverview(input: DashboardInput): Promise<ExecutiveOverview> {
  const user = await requireUser();
  assertCan(user, 'executive.overview.read');
  const scoped = await getScopedDb();
  const [dashboard, report, supportOverdue] = await Promise.all([
    readDashboard(input, false),
    readReport({ ...input, group: 'don-vi', page: 1, pageSize: 100 }),
    scoped.supportRequest.count({ where: overdueWhere(new Date()) }),
  ]);
  return {
    dashboard,
    units: report.group === 'don-vi' ? report.rows : [],
    supportOverdue,
  };
}
