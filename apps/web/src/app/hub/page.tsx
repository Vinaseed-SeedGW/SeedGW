import { Briefcase, Settings, type LucideIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { DepartmentSlug } from '@dms/contracts/departments';
import { Can } from '@/features/auth/components/can';
import { HubLayout } from '@/features/shell/components/hub-layout';
import { requireUser } from '@/server/auth/current-user';
import { getHubSummary } from '@/server/queries/hub';

export const metadata: Metadata = { title: 'Hub' };

const DEPARTMENT_ICON: Record<DepartmentSlug, LucideIcon> = {
  'kinh-doanh': Briefcase,
  'quan-tri': Settings,
};

export default async function HubPage() {
  const [user, summary] = await Promise.all([requireUser(), getHubSummary()]);

  return (
    <HubLayout userName={user.fullName}>
      <h1 className="text-2xl font-bold text-brand">Xin chào, {user.fullName}</h1>
      <p className="mt-1 text-text-muted">Chọn bộ phận để bắt đầu làm việc</p>

      <div className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-4">
        {summary.departments.map((department) => {
          const Icon = DEPARTMENT_ICON[department.slug];
          return (
            <Link
              key={department.slug}
              href={`/${department.slug}`}
              className="block rounded-md border border-border bg-surface p-5 hover:border-brand"
            >
              <Icon className="text-brand" size={28} aria-hidden />
              <h2 className="mt-3 text-lg font-bold text-brand">{department.name}</h2>
              <span className="inline-block text-sm text-text-muted">{department.description}</span>
              <span className="mt-3.5 block">
                <span className="inline-block text-3xl font-bold">{department.pendingCount}</span>{' '}
                <span className="inline-block text-sm text-text-muted">việc chờ xử lý</span>
              </span>
            </Link>
          );
        })}
      </div>

      {summary.supportOverdue !== null ? (
        <Link
          href="/quan-tri/ho-tro?xem=dang-mo&han=qua-han"
          className={`mt-4 flex flex-wrap items-baseline gap-2 rounded-md border p-4 hover:border-brand ${
            summary.supportOverdue > 0 ? 'border-danger bg-danger-soft' : 'border-border bg-surface'
          }`}
        >
          <span className="text-2xl font-bold">{summary.supportOverdue}</span>
          <span className="font-bold">yêu cầu hỗ trợ quá hạn</span>
          <span className="text-sm text-text-muted">
            {summary.supportOverdue > 0
              ? 'Quá hạn phản hồi đầu hoặc hạn xử lý theo Tham số. Bấm để xem.'
              : 'Không có yêu cầu nào quá hạn.'}
          </span>
        </Link>
      ) : null}

      {summary.departments.length === 0 ? (
        <p className="mt-5 text-text-muted">
          Tài khoản của bạn chưa được cấp quyền vào bộ phận nào. Vui lòng liên hệ quản trị hệ thống.
        </p>
      ) : null}

      <Can permission="executive.overview.read">
        <Link href="/tong-quan" className="mt-5 inline-block font-bold text-brand">
          Xem Tổng quan điều hành
        </Link>
      </Can>

      <section className="mt-6 rounded-md border border-border bg-surface p-5">
        <h2 className="text-lg font-bold">Thông báo gần đây</h2>
        {summary.notifications.length === 0 ? (
          <p className="mt-2 text-text-muted">Chưa có thông báo nào.</p>
        ) : (
          <ul className="mt-2">
            {summary.notifications.map((notification) => (
              <li key={notification.id} className="py-1">
                <Link href={notification.href} className="text-brand">
                  {notification.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </HubLayout>
  );
}
