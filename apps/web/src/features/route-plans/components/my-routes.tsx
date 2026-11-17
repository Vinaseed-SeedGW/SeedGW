import Link from 'next/link';
import { formatDateTime } from '@dms/contracts/format';
import {
  ROUTE_KIND_LABEL,
  type MyRoutePeriod,
  type MyRoutesResult,
} from '@dms/contracts/route-plans';
import { ApprovalWithdrawButton } from '@/features/approvals/components/approval-decision';
import { ApprovalStatusBadge } from '@/features/approvals/components/approval-status-badge';
import { CompletionText, RouteDays } from './route-days';

function PeriodCard({
  period,
  canOpenApproval,
}: {
  period: MyRoutePeriod;
  canOpenApproval: boolean;
}) {
  const plan = period.plan;
  const days = plan?.approved ?? plan?.proposed ?? [];
  const revisionPending =
    plan?.approved !== null &&
    plan?.approved !== undefined &&
    (plan.approvalStatus === 'PENDING_MANAGER' || plan.approvalStatus === 'PENDING_LEADER');
  return (
    <section
      aria-labelledby={`tuyen-${period.periodStart}`}
      className="min-w-0 rounded-md border border-border bg-surface p-4"
    >
      <div className="flex flex-wrap items-center gap-3">
        <h3 id={`tuyen-${period.periodStart}`} className="text-lg font-bold text-brand">
          {period.periodLabel}
        </h3>
        {plan?.approvalStatus ? <ApprovalStatusBadge status={plan.approvalStatus} /> : null}
        {plan?.isLate ? (
          <span className="rounded-sm bg-warning-soft px-1.5 text-sm">Nộp muộn</span>
        ) : null}
        {plan?.approvalCode ? (
          canOpenApproval ? (
            <Link
              href={`/kinh-doanh/can-duyet/${plan.approvalCode}`}
              className="text-sm text-brand hover:underline"
            >
              Phiếu {plan.approvalCode}
            </Link>
          ) : (
            <span className="text-sm text-text-muted">Phiếu {plan.approvalCode}</span>
          )
        ) : null}
      </div>
      <p className="mt-1 text-sm text-text-muted">
        {period.editable
          ? `Hạn nộp ${formatDateTime(period.deadline)}${period.pastDeadline ? ', đã qua hạn (vẫn nộp được, gắn nhãn Nộp muộn)' : ''}`
          : 'Kỳ đã qua, chỉ xem'}
      </p>
      {plan?.returnReason ? (
        <p role="note" className="mt-2 rounded-md bg-danger-soft px-2.5 py-2">
          <span className="font-bold text-danger">Lý do trả lại: </span>
          {plan.returnReason}
        </p>
      ) : null}
      {revisionPending ? (
        <p className="mt-2 rounded-md bg-warning-soft px-2.5 py-2">
          Bản sửa đang chờ duyệt, dưới đây là tuyến đã duyệt đang có hiệu lực.
        </p>
      ) : null}
      {plan ? (
        <>
          {plan.approved ? (
            <p className="mt-2">
              <CompletionText completion={plan.completion} />
            </p>
          ) : null}
          <RouteDays days={days} />
        </>
      ) : (
        <p className="mt-2 text-text-muted">
          {period.editable ? 'Chưa đăng ký tuyến kỳ này.' : 'Không có tuyến.'}
        </p>
      )}
      {plan?.canWithdraw && plan.approvalCode ? (
        <div className="mt-3">
          <ApprovalWithdrawButton code={plan.approvalCode} />
        </div>
      ) : null}
    </section>
  );
}

/** Tuyến của tôi trên web: xem và rút lại; đăng ký, sửa tuyến làm trên app (duyệt 17/11/2026). */
export function MyRoutes({
  data,
  canOpenApproval,
}: {
  data: MyRoutesResult;
  canOpenApproval: boolean;
}) {
  return (
    <>
      <p className="mt-4 rounded-md bg-brand-soft px-3 py-2">
        Đơn vị của bạn đăng ký tuyến <b>{ROUTE_KIND_LABEL[data.kind].toLowerCase()}</b>. Đăng ký và
        sửa tuyến trên app Check-in, ở tab Tuyến.
      </p>
      <div className="mt-4 grid gap-4">
        {data.periods.map((period) => (
          <PeriodCard
            key={`${period.kind}-${period.periodStart}`}
            period={period}
            canOpenApproval={canOpenApproval}
          />
        ))}
      </div>
    </>
  );
}
