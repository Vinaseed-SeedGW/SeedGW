import Link from 'next/link';
import { PENDING_APPROVAL_STATUSES } from '@dms/contracts/approvals';
import type { MyTargetMonth, MyTargetsResult } from '@dms/contracts/sales-targets';
import { ApprovalWithdrawButton } from '@/features/approvals/components/approval-decision';
import { ApprovalStatusBadge } from '@/features/approvals/components/approval-status-badge';
import { TargetCompare } from './target-compare';
import { TargetEditButton, TargetRegisterButton } from './target-form-sheet';

function MonthActions({ month }: { month: MyTargetMonth }) {
  const target = month.target;
  if (!month.editable) return null;
  if (!target) return <TargetRegisterButton month={month.month} />;
  const pending =
    target.approvalStatus !== null && PENDING_APPROVAL_STATUSES.includes(target.approvalStatus);
  return (
    <div className="flex flex-wrap gap-2">
      {pending ? null : (
        <TargetEditButton
          month={month.month}
          current={target.proposed}
          hasApproved={target.approved !== null}
        />
      )}
      {target.canWithdraw && target.approvalCode ? (
        <ApprovalWithdrawButton code={target.approvalCode} />
      ) : null}
    </div>
  );
}

function MonthCard({ month, canOpenApproval }: { month: MyTargetMonth; canOpenApproval: boolean }) {
  const target = month.target;
  return (
    <section
      aria-labelledby={`thang-${month.month}`}
      className="rounded-md border border-border bg-surface p-4"
    >
      <div className="flex flex-wrap items-center gap-3">
        <h2 id={`thang-${month.month}`} className="text-lg font-bold text-brand">
          {month.monthLabel}
        </h2>
        {target?.approvalStatus ? <ApprovalStatusBadge status={target.approvalStatus} /> : null}
        {target?.approvalCode ? (
          canOpenApproval ? (
            <Link
              href={`/kinh-doanh/can-duyet/${target.approvalCode}`}
              className="text-sm text-brand hover:underline"
            >
              Phiếu {target.approvalCode}
            </Link>
          ) : (
            <span className="text-sm text-text-muted">Phiếu {target.approvalCode}</span>
          )
        ) : null}
        {!month.editable ? <span className="text-sm text-text-muted">Chỉ xem</span> : null}
      </div>

      {target?.returnReason ? (
        <p role="note" className="mt-3 rounded-md bg-danger-soft px-2.5 py-2">
          <span className="font-bold text-danger">Lý do trả lại: </span>
          {target.returnReason}
        </p>
      ) : null}

      {target ? (
        <TargetCompare
          view={{ proposed: target.proposed, approved: target.approved, progress: month.progress }}
        />
      ) : (
        <p className="mt-2 text-text-muted">
          {month.editable ? 'Chưa đăng ký chỉ tiêu tháng này.' : 'Không có chỉ tiêu tháng này.'}
        </p>
      )}

      <div className="mt-3">
        <MonthActions month={month} />
      </div>
    </section>
  );
}

/** Chỉ tiêu của tôi: tháng sau, tháng này đăng ký hoặc sửa được; tháng đã qua chỉ xem. */
export function MyTargets({
  data,
  canOpenApproval,
}: {
  data: MyTargetsResult;
  canOpenApproval: boolean;
}) {
  return (
    <div className="mt-4 grid gap-4 xl:grid-cols-2">
      {data.months.map((month) => (
        <MonthCard key={month.month} month={month} canOpenApproval={canOpenApproval} />
      ))}
    </div>
  );
}
