import Link from 'next/link';
import type { ReactNode } from 'react';
import { canAccessDepartment, canAccessPath } from '@seedgw/contracts/access';
import { DEPARTMENTS, type DepartmentSlug } from '@seedgw/contracts/departments';
import { AppFooter } from '@seedgw/ui/app-footer';
import { AppShell } from '@seedgw/ui/app-shell';
import { LogoutButton } from '@/features/auth/components/logout-button';
import { DepartmentBreadcrumb } from '@/features/shell/components/department-breadcrumb';
import { NotificationBell } from '@/features/notifications/components/notification-bell';
import { GlobalSearch } from '@/features/shell/components/global-search';
import { ImpersonationBanner } from '@/features/shell/components/impersonation-banner';
import { listSearchPages } from '@/features/shell/search-pages';
import { DEPARTMENT_NAV } from '@/features/shell/navigation';
import { SupportLauncher } from '@/features/support/components/support-launcher';
import { requireDepartmentAccess } from '@/server/auth/can';
import { getPendingApprovalCount } from '@/server/queries/approvals';
import { getLocationProposalPendingCount } from '@/server/queries/dealer-locations';
import { getDealerProposalPendingCount } from '@/server/queries/dealer-proposals';
import { getSupportPendingCount } from '@/server/queries/support';

// Mục có số việc đang chờ cạnh tên (A10b).
const NAV_COUNTS: Partial<Record<string, () => Promise<number>>> = {
  '/kinh-doanh/can-duyet': getPendingApprovalCount,
  '/quan-tri/ho-tro': getSupportPendingCount,
  '/quan-tri/dai-ly/dai-ly-moi': getDealerProposalPendingCount,
  '/quan-tri/dai-ly/duyet-toa-do': getLocationProposalPendingCount,
};

type DepartmentLayoutProps = {
  slug: DepartmentSlug;
  children: ReactNode;
};

const SWITCHER_LINK_CLASS = 'hover:bg-brand-soft block rounded-sm px-2.5 py-1.5 whitespace-nowrap';

export async function DepartmentLayout({ slug, children }: DepartmentLayoutProps) {
  const user = await requireDepartmentAccess(slug);
  const current = DEPARTMENTS.find((department) => department.slug === slug);
  const groups = DEPARTMENT_NAV[slug]
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canAccessPath(user.permissions, item.href)),
    }))
    .filter((group) => group.items.length > 0);
  const pages = groups.flatMap((group) => group.items.map(({ href, label }) => ({ href, label })));
  const counts = new Map(
    await Promise.all(
      pages
        .filter((page) => NAV_COUNTS[page.href])
        .map(async (page) => [page.href, (await NAV_COUNTS[page.href]?.()) ?? 0] as const),
    ),
  );
  const otherDepartments = DEPARTMENTS.filter(
    (department) =>
      department.slug !== slug && canAccessDepartment(user.permissions, department.slug),
  );

  return (
    <AppShell.Root navHrefs={pages.map((page) => page.href)}>
      <AppShell.Sidebar homeHref="/hub">
        {groups.map((group, index) => (
          <AppShell.NavGroup key={group.label ?? index} label={group.label}>
            {group.items.map((item) => (
              <AppShell.NavItem
                key={item.href}
                href={item.href}
                label={item.label}
                count={counts.get(item.href)}
              >
                <item.icon aria-hidden />
              </AppShell.NavItem>
            ))}
          </AppShell.NavGroup>
        ))}
      </AppShell.Sidebar>
      <AppShell.Main>
        <ImpersonationBanner />
        <AppShell.Header>
          <AppShell.Breadcrumb>
            <DepartmentBreadcrumb departmentName={current?.name ?? ''} pages={pages} />
          </AppShell.Breadcrumb>
          <AppShell.DeptSwitcher label={current?.name ?? 'Bộ phận'}>
            <Link href="/hub" className={SWITCHER_LINK_CLASS}>
              Về Hub
            </Link>
            {otherDepartments.map((department) => (
              <Link
                key={department.slug}
                href={`/${department.slug}`}
                className={SWITCHER_LINK_CLASS}
              >
                {department.name}
              </Link>
            ))}
          </AppShell.DeptSwitcher>
          <GlobalSearch pages={listSearchPages(user.permissions)} />
          <NotificationBell />
          <span className="hidden flex-none sm:inline">{user.fullName}</span>
          <LogoutButton />
        </AppShell.Header>
        <AppShell.Content>{children}</AppShell.Content>
        <AppFooter variant="compact" />
        <SupportLauncher />
      </AppShell.Main>
    </AppShell.Root>
  );
}
