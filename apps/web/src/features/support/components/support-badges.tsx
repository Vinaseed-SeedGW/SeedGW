import {
  SUPPORT_DUE_LABEL,
  SUPPORT_SEVERITY_LABEL,
  SUPPORT_STATUS_LABEL,
  SUPPORT_TYPE_LABEL,
  type SupportDueView,
  type SupportSeverity,
  type SupportStatus,
  type SupportType,
} from '@dms/contracts/support';
import { formatDateTime } from '@dms/contracts/format';

const BADGE = 'inline-block rounded-sm px-1.5 text-sm font-bold whitespace-nowrap';

const STATUS_TONE: Record<SupportStatus, string> = {
  NEW: 'bg-warning-soft text-text',
  IN_PROGRESS: 'bg-brand-soft text-brand',
  WAITING_REQUESTER: 'bg-surface-subtle text-text',
  DONE: 'bg-brand text-primary-foreground',
  CLOSED: 'bg-surface-subtle text-text-muted',
};

export function SupportStatusBadge({ status }: { status: SupportStatus }) {
  return <span className={`${BADGE} ${STATUS_TONE[status]}`}>{SUPPORT_STATUS_LABEL[status]}</span>;
}

/** Loại, kèm mức độ nếu là Báo lỗi. */
export function supportKindText(type: SupportType, severity: SupportSeverity | null): string {
  return severity
    ? `${SUPPORT_TYPE_LABEL[type]}, ${SUPPORT_SEVERITY_LABEL[severity]}`
    : SUPPORT_TYPE_LABEL[type];
}

export function SupportSeverityBadge({ severity }: { severity: SupportSeverity | null }) {
  if (severity !== 'BLOCKER') return null;
  return (
    <span className={`${BADGE} bg-danger-soft text-danger`}>{SUPPORT_SEVERITY_LABEL.BLOCKER}</span>
  );
}

const DUE_TONE = {
  ON_TIME: 'text-text-muted',
  DUE_SOON: 'bg-warning-soft text-text',
  OVERDUE: 'bg-danger-soft text-danger',
} as const;

/** Hạn phản hồi đầu hoặc hạn xử lý, chỉ hiện với bên xử lý. */
export function SupportDueBadge({ due }: { due: SupportDueView | null }) {
  if (!due) return null;
  const stage = due.stage === 'FIRST_RESPONSE' ? 'phản hồi' : 'xử lý';
  return (
    <span className={`${BADGE} font-normal ${DUE_TONE[due.state]}`}>
      {due.state === 'ON_TIME'
        ? `Hạn ${stage} ${formatDateTime(due.dueAt)}`
        : `${SUPPORT_DUE_LABEL[due.state]}, hạn ${stage} ${formatDateTime(due.dueAt)}`}
    </span>
  );
}
