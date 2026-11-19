import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { editableRoutePeriods, ROUTE_KIND_LABEL } from '@seedgw/contracts/route-plans';
import { ApprovalStatusBadge } from '@/features/approvals/components/approval-status-badge';
import { CompletionText, RouteDays } from '@/features/route-plans/components/route-days';
import { can, requirePermission } from '@/server/auth/can';
import { getRoutePlan } from '@/server/queries/route-plans';

export const metadata: Metadata = { title: 'Chi tiết tuyến' };

type PageProps = { params: Promise<{ id: string }> };

export default async function RoutePlanPage({ params }: PageProps) {
  const user = await requirePermission('sales.route.read');
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const plan = await getRoutePlan(id.data);
  if (!plan) notFound();
  const pendingRevision =
    plan.approved !== null &&
    (plan.approvalStatus === 'PENDING_MANAGER' || plan.approvalStatus === 'PENDING_LEADER');

  return (
    <>
      <Link
        href="/kinh-doanh/tuyen-vieng-tham?tab=pham-vi"
        className="text-sm text-brand hover:underline"
      >
        Về danh sách tuyến
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-brand">{plan.periodLabel}</h1>
        {plan.approvalStatus ? <ApprovalStatusBadge status={plan.approvalStatus} /> : null}
        {plan.isLate ? (
          <span className="rounded-sm bg-warning-soft px-1.5 text-sm">Nộp muộn</span>
        ) : null}
      </div>
      <p className="mt-1 text-text-muted">
        {plan.userName} ({plan.userCode}){plan.orgUnitName ? `, ${plan.orgUnitName}` : ''}, tuyến{' '}
        {ROUTE_KIND_LABEL[plan.kind].toLowerCase()}
        {plan.approvalCode ? (
          can(user, 'sales.approval.read') ? (
            <>
              {', '}
              <Link
                href={`/kinh-doanh/can-duyet/${plan.approvalCode}`}
                className="text-brand hover:underline"
              >
                phiếu {plan.approvalCode}
              </Link>
            </>
          ) : (
            `, phiếu ${plan.approvalCode}`
          )
        ) : null}
      </p>
      {plan.note ? <p className="mt-2">Ghi chú: {plan.note}</p> : null}
      {can(user, 'sales.approval.override') &&
      !pendingRevision &&
      plan.approvalStatus !== 'PENDING_MANAGER' &&
      plan.approvalStatus !== 'PENDING_LEADER' &&
      editableRoutePeriods(plan.kind).includes(plan.periodStart) ? (
        <p className="mt-3">
          <Link
            href={`/kinh-doanh/tuyen-vieng-tham/dang-ky?ky=${plan.periodStart}&nhan-vien=${plan.userCode}`}
            className="inline-flex h-9.5 items-center rounded-md border border-border bg-surface px-4 font-bold hover:bg-brand-soft"
          >
            Sửa thay
          </Link>
        </p>
      ) : null}

      {plan.approved ? (
        <section className="mt-5">
          <h2 className="text-lg font-bold text-brand">Tuyến đã duyệt</h2>
          <p className="mt-1">
            <CompletionText completion={plan.completion} />
          </p>
          <RouteDays days={plan.approved} />
        </section>
      ) : null}
      {!plan.approved || pendingRevision ? (
        <section className="mt-5">
          <h2 className="text-lg font-bold text-brand">
            {plan.approved ? 'Bản sửa đang chờ duyệt' : 'Tuyến đề nghị'}
          </h2>
          <RouteDays days={plan.proposed} />
        </section>
      ) : null}
    </>
  );
}
