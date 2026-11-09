import type { UserStatus } from '@dms/contracts/users';
import { cn } from '@dms/ui/cn';

export const USER_STATUS_LABEL: Record<UserStatus, string> = {
  ACTIVE: 'Hoạt động',
  LOCKED: 'Đã khoá',
};

const STATUS_CLASS: Record<UserStatus, string> = {
  ACTIVE: 'bg-brand-soft text-brand',
  LOCKED: 'bg-danger-soft text-danger',
};

export function UserStatusBadge({ status }: { status: UserStatus }) {
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-xs font-bold', STATUS_CLASS[status])}>
      {USER_STATUS_LABEL[status]}
    </span>
  );
}
