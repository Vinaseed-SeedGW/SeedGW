import 'server-only';
import { canAccessDepartment } from '@seedgw/contracts/access';
import { DEPARTMENTS, type DepartmentSlug } from '@seedgw/contracts/departments';
import type { HubSummary } from '@seedgw/contracts/hub';
import { requireUser } from '@/server/auth/current-user';
import { getPendingApprovalCount } from '@/server/queries/approvals';
import { getSupportOverdueCount, getSupportPendingCount } from '@/server/queries/support';

// Số việc chờ của từng bộ phận: phiếu chờ tôi duyệt (Kinh doanh), yêu cầu hỗ trợ cần xử lý (Quản trị).
const PENDING: Record<DepartmentSlug, () => Promise<number>> = {
  'kinh-doanh': getPendingApprovalCount,
  'quan-tri': getSupportPendingCount,
};

export async function getHubSummary(): Promise<HubSummary> {
  const user = await requireUser();
  const departments = DEPARTMENTS.filter((department) =>
    canAccessDepartment(user.permissions, department.slug),
  );
  const [counts, supportOverdue] = await Promise.all([
    Promise.all(departments.map((department) => PENDING[department.slug]())),
    getSupportOverdueCount(),
  ]);
  return {
    departments: departments.map((department, index) => ({
      ...department,
      pendingCount: counts[index] ?? 0,
    })),
    notifications: [],
    supportOverdue,
  };
}
