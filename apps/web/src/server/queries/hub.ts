import 'server-only';
import { canAccessDepartment, type PermissionCode } from '@seedgw/contracts/access';
import { DEPARTMENTS, type DepartmentSlug } from '@seedgw/contracts/departments';
import type { HubSummary, HubTodo } from '@seedgw/contracts/hub';
import { can } from '@/server/auth/can';
import { requireUser } from '@/server/auth/current-user';
import { getPendingApprovalCount } from '@/server/queries/approvals';
import { getLocationProposalPendingCount } from '@/server/queries/dealer-locations';
import { getDealerProposalPendingCount } from '@/server/queries/dealer-proposals';
import { getSupportOverdueCount, getSupportPendingCount } from '@/server/queries/support';
import { getPendingDeviceUserCount } from '@/server/queries/users';

// D3: việc đang chờ theo quyền. Mỗi loại việc thuộc một bộ phận để cộng số trên ô bộ phận.
const TODOS: ReadonlyArray<{
  key: HubTodo['key'];
  label: string;
  href: string;
  department: DepartmentSlug;
  permission: PermissionCode;
  count: () => Promise<number>;
}> = [
  {
    key: 'approvals',
    label: 'Tuyến, chỉ tiêu, đại lý mới chờ tôi duyệt',
    href: '/kinh-doanh/can-duyet',
    department: 'kinh-doanh',
    permission: 'sales.approval.review',
    count: getPendingApprovalCount,
  },
  {
    key: 'support',
    label: 'Yêu cầu hỗ trợ cần xử lý',
    href: '/quan-tri/ho-tro?xem=can-xu-ly',
    department: 'quan-tri',
    permission: 'support.request.manage',
    count: getSupportPendingCount,
  },
  {
    key: 'dealer-proposals',
    label: 'Đại lý mới đang chờ duyệt',
    href: '/quan-tri/dai-ly/dai-ly-moi',
    department: 'quan-tri',
    permission: 'sales.approval.override',
    count: getDealerProposalPendingCount,
  },
  {
    key: 'locations',
    label: 'Toạ độ đại lý chờ duyệt',
    href: '/quan-tri/dai-ly/duyet-toa-do',
    department: 'quan-tri',
    permission: 'admin.dealer-location.approve',
    count: getLocationProposalPendingCount,
  },
  {
    key: 'devices',
    label: 'Tài khoản có máy mới chờ duyệt',
    href: '/quan-tri/tai-khoan?thiet-bi=cho-duyet',
    department: 'quan-tri',
    permission: 'admin.user.manage',
    count: getPendingDeviceUserCount,
  },
];

export async function getHubSummary(): Promise<HubSummary> {
  const user = await requireUser();
  const departments = DEPARTMENTS.filter((department) =>
    canAccessDepartment(user.permissions, department.slug),
  );
  const allowed = TODOS.filter((todo) => can(user, todo.permission));
  const [counts, supportOverdue] = await Promise.all([
    Promise.all(allowed.map((todo) => todo.count())),
    getSupportOverdueCount(),
  ]);
  const todos = allowed.map((todo, index) => ({ ...todo, count: counts[index] ?? 0 }));
  return {
    departments: departments.map((department) => ({
      ...department,
      pendingCount: todos
        .filter((todo) => todo.department === department.slug)
        .reduce((sum, todo) => sum + todo.count, 0),
    })),
    todos: todos.map(({ key, label, count, href }) => ({ key, label, count, href })),
    notifications: [],
    supportOverdue,
  };
}
