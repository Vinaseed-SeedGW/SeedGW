import {
  BarChart3,
  Briefcase,
  ChevronRight,
  CircleCheck,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { DepartmentSlug } from '@seedgw/contracts/departments';
import { formatNumber } from '@seedgw/contracts/format';
import { Can } from '@/features/auth/components/can';
import { HubLayout } from '@/features/shell/components/hub-layout';
import { listSearchPages } from '@/features/shell/search-pages';
import { requireUser } from '@/server/auth/current-user';
import { getHubSummary } from '@/server/queries/hub';
import { getRecentNotifications } from '@/server/queries/notifications';

export const metadata: Metadata = { title: 'Hub' };

const DEPARTMENT_ICON: Record<DepartmentSlug, LucideIcon> = {
  'kinh-doanh': Briefcase,
  'quan-tri': Settings,
};

const TILE_CLASS =
  'group flex flex-col rounded-lg border border-border bg-surface p-5 transition-colors duration-150 hover:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';

export default async function HubPage() {
  const [user, summary, notifications] = await Promise.all([
    requireUser(),
    getHubSummary(),
    getRecentNotifications(5),
  ]);
  const waiting = summary.todos.filter((todo) => todo.count > 0);

  return (
    <HubLayout userName={user.fullName} searchPages={listSearchPages(user.permissions)}>
      <h1 className="text-2xl font-bold text-brand">Xin chào, {user.fullName}</h1>
      <p className="mt-1 text-text-muted">Chọn bộ phận để bắt đầu làm việc</p>

      <div className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] gap-4">
        {summary.departments.map((department) => {
          const Icon = DEPARTMENT_ICON[department.slug];
          return (
            <Link key={department.slug} href={`/${department.slug}`} className={TILE_CLASS}>
              <span className="flex items-start justify-between gap-3">
                <span className="inline-flex size-12 items-center justify-center rounded-lg bg-brand-soft text-brand">
                  <Icon size={24} aria-hidden />
                </span>
                <ChevronRight
                  size={20}
                  className="mt-1 text-text-muted transition-colors group-hover:text-brand"
                  aria-hidden
                />
              </span>
              <span className="mt-4 text-lg font-bold text-brand">{department.name}</span>
              <span className="mt-1 text-sm text-text-muted">{department.description}</span>
              <span className="mt-auto flex items-baseline gap-2 border-t border-border pt-3.5">
                <span className="text-3xl font-bold tabular-nums">
                  {formatNumber(department.pendingCount)}
                </span>
                <span className="text-sm text-text-muted">việc chờ xử lý</span>
              </span>
            </Link>
          );
        })}
        <Can permission="executive.overview.read">
          <Link
            href="/tong-quan"
            className="group flex flex-col rounded-lg bg-brand p-5 text-primary-foreground transition-colors duration-150 hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <span className="flex items-start justify-between gap-3">
              <span className="inline-flex size-12 items-center justify-center rounded-lg bg-brand-hover">
                <BarChart3 size={24} aria-hidden />
              </span>
              <ChevronRight size={20} className="mt-1" aria-hidden />
            </span>
            <span className="mt-4 text-lg font-bold">Tổng quan điều hành</span>
            <span className="mt-1 text-sm">
              Độ phủ, lượt ghé thăm, so sánh đơn vị và mục Cần chú ý trên một màn hình.
            </span>
          </Link>
        </Can>
      </div>

      {summary.departments.length === 0 ? (
        <p className="mt-5 rounded-lg border border-border bg-surface p-4 text-text-muted">
          Tài khoản của bạn chưa được cấp quyền vào bộ phận nào. Vui lòng liên hệ quản trị hệ thống.
        </p>
      ) : null}

      {summary.supportOverdue !== null && summary.supportOverdue > 0 ? (
        <Link
          href="/quan-tri/ho-tro?xem=dang-mo&han=qua-han"
          className="mt-4 flex flex-wrap items-baseline gap-2 rounded-lg border border-danger bg-danger-soft p-4 hover:border-brand focus-visible:outline-2 focus-visible:outline-brand"
        >
          <span className="text-2xl font-bold tabular-nums">
            {formatNumber(summary.supportOverdue)}
          </span>
          <span className="font-bold">yêu cầu hỗ trợ quá hạn</span>
          <span className="text-sm text-text-muted">
            Quá hạn phản hồi đầu hoặc hạn xử lý theo Tham số. Bấm để xem.
          </span>
        </Link>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {summary.todos.length > 0 ? (
          <section className="rounded-lg border border-border bg-surface p-5">
            <h2 className="text-lg font-bold">Việc cần làm của tôi</h2>
            {waiting.length === 0 ? (
              <p className="mt-3 flex items-center gap-2 text-text-muted">
                <CircleCheck size={20} className="text-brand" aria-hidden />
                Không có việc nào đang chờ bạn.
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-border">
                {waiting.map((todo) => (
                  <li key={todo.key}>
                    <Link
                      href={todo.href}
                      className="flex min-h-12 items-center justify-between gap-3 py-2 hover:text-brand focus-visible:outline-2 focus-visible:outline-brand"
                    >
                      <span>{todo.label}</span>
                      <span className="inline-flex min-w-8 items-center justify-center rounded-md bg-warning-soft px-2 py-0.5 font-bold tabular-nums">
                        {formatNumber(todo.count)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        <section className="rounded-lg border border-border bg-surface p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-bold">Thông báo gần đây</h2>
            <Link href="/thong-bao" className="text-sm font-bold text-brand hover:underline">
              Xem tất cả
            </Link>
          </div>
          {notifications.length === 0 ? (
            <p className="mt-3 text-text-muted">Chưa có thông báo nào.</p>
          ) : (
            <ul className="mt-2 divide-y divide-border">
              {notifications.map((notification) => (
                <li key={notification.id} className="py-2.5">
                  <Link
                    href={notification.href ?? '/thong-bao'}
                    className="block hover:text-brand focus-visible:outline-2 focus-visible:outline-brand"
                  >
                    <span className={notification.read ? '' : 'font-bold'}>
                      {notification.title}
                    </span>
                    <span className="block text-sm text-text-muted">{notification.body}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </HubLayout>
  );
}
