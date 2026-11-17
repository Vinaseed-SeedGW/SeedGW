import { APPROVAL_STATUS_LABEL, type ApprovalStatus } from '@dms/contracts/approvals';

const TONE: Record<ApprovalStatus, string> = {
  DRAFT: 'bg-surface-subtle text-text-muted',
  PENDING_MANAGER: 'bg-warning-soft text-text',
  PENDING_LEADER: 'bg-warning-soft text-text',
  RETURNED: 'bg-danger-soft text-danger',
  APPROVED: 'bg-brand-soft text-brand',
  WITHDRAWN: 'bg-surface-subtle text-text-muted',
};

export function ApprovalStatusBadge({ status }: { status: ApprovalStatus }) {
  return (
    <span
      className={`inline-block rounded-sm px-1.5 text-sm font-bold whitespace-nowrap ${TONE[status]}`}
    >
      {APPROVAL_STATUS_LABEL[status]}
    </span>
  );
}
