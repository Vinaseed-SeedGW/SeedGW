import Link from 'next/link';
import { PENDING_APPROVAL_STATUSES } from '@seedgw/contracts/approvals';
import { formatNumber } from '@seedgw/contracts/format';
import {
  targetPercent,
  type MyTargetMonth,
  type MyTargetsResult,
} from '@seedgw/contracts/sales-targets';
import { ApprovalWithdrawButton } from '@/features/approvals/components/approval-decision';
import { ApprovalStatusBadge } from '@/features/approvals/components/approval-status-badge';
import { PercentBar, TargetCompare } from './target-compare';
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

/** K3: chỉ tiêu được giao thay chỉ tiêu tự đăng ký của tháng đó. */
function AssignedTarget({
  assigned,
  progress,
}: {
  assigned: NonNullable<MyTargetMonth['assigned']>;
  progress: MyTargetMonth['progress'];
}) {
  const rows = [
    {
      label: 'Lượt ghé thăm',
      target: assigned.visitCountTarget,
      actual: progress.visitCount,
      unit: 'lượt',
    },
    {
      label: 'Số đại lý được ghé',
      target: assigned.dealerCoverageTarget,
      actual: progress.dealerCoverage,
      unit: 'đại lý',
    },
  ];
  return (
    <div className="mt-2">
      <p className="text-sm text-text-muted">
        Chỉ tiêu được giao bởi {assigned.assignedByName}
        {assigned.note ? `. ${assigned.note}` : ''}
      </p>
      <dl className="mt-2 grid gap-3 sm:grid-cols-2">
        {rows.map((row) => {
          const percent = targetPercent(row.actual, row.target);
          return (
            <div key={row.label}>
              <dt className="text-sm text-text-muted">{row.label}</dt>
              <dd className="font-bold">
                {formatNumber(row.actual)} / {formatNumber(row.target)} {row.unit}
                {percent !== null ? `, ${percent}%` : ''}
              </dd>
              <PercentBar percent={percent} />
            </div>
          );
        })}
      </dl>
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
        {month.assigned ? (
          <span className="text-sm text-text-muted">Được giao</span>
        ) : !month.editable ? (
          <span className="text-sm text-text-muted">Chỉ xem</span>
        ) : null}
      </div>

      {target?.returnReason ? (
        <p role="note" className="mt-3 rounded-md bg-danger-soft px-2.5 py-2">
          <span className="font-bold text-danger">Lý do trả lại: </span>
          {target.returnReason}
        </p>
      ) : null}

      {month.assigned ? (
        <AssignedTarget assigned={month.assigned} progress={month.progress} />
      ) : target ? (
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
