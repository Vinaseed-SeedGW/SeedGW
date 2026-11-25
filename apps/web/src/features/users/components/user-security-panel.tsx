'use client';

import { useState } from 'react';
import { formatDateTime } from '@seedgw/contracts/format';
import type { UserDetail } from '@seedgw/contracts/users';
import { ConfirmDialog } from '@seedgw/ui/confirm-dialog';
import { UserPasswordDialog } from '@/features/users/components/user-password-dialog';
import { UserStatusBadge } from '@/features/users/components/user-status-badge';
import { setUsersActiveAction, startImpersonationAction } from '@/server/actions/users';

type PanelDialog = 'LOCK' | 'UNLOCK' | 'RESET' | 'IMPERSONATE';

const ACTION_CLASS =
  'h-9.5 rounded-md border border-brand bg-surface px-4 font-bold text-brand hover:bg-brand-soft';
const DANGER_ACTION_CLASS =
  'h-9.5 rounded-md border border-danger bg-surface px-4 font-bold text-danger hover:bg-danger-soft';

export function UserSecurityPanel({ user }: { user: UserDetail }) {
  const [dialog, setDialog] = useState<PanelDialog | null>(null);
  const closeDialog = () => setDialog(null);
  const isActive = user.status === 'ACTIVE';

  return (
    <section className="mt-6 rounded-md border border-border bg-surface p-4">
      <h2 className="text-lg font-bold">Bảo mật</h2>
      <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5">
        <dt className="text-text-muted">Trạng thái</dt>
        <dd>
          <UserStatusBadge status={user.status} />
        </dd>
        <dt className="text-text-muted">Mật khẩu</dt>
        <dd>{user.mustChangePassword ? 'Chờ người dùng đổi mật khẩu' : 'Đang dùng'}</dd>
        {user.loginLockedUntil ? (
          <>
            <dt className="text-text-muted">Đăng nhập</dt>
            <dd className="text-danger">
              Tạm khoá đến {formatDateTime(user.loginLockedUntil)} do nhập sai nhiều lần
            </dd>
          </>
        ) : null}
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        {user.allowed.resetPassword ? (
          <button type="button" className={ACTION_CLASS} onClick={() => setDialog('RESET')}>
            Đặt lại mật khẩu
          </button>
        ) : null}
        {user.allowed.impersonate ? (
          <button type="button" className={ACTION_CLASS} onClick={() => setDialog('IMPERSONATE')}>
            Đăng nhập thay
          </button>
        ) : null}
        {user.allowed.lock ? (
          <button
            type="button"
            className={isActive ? DANGER_ACTION_CLASS : ACTION_CLASS}
            onClick={() => setDialog(isActive ? 'LOCK' : 'UNLOCK')}
          >
            {isActive ? 'Khoá tài khoản' : 'Mở khoá tài khoản'}
          </button>
        ) : null}
      </div>

      {dialog === 'LOCK' ? (
        <ConfirmDialog
          title="Khoá tài khoản"
          confirmLabel="Khoá"
          tone="danger"
          successMessage="Đã khoá tài khoản"
          onClose={closeDialog}
          onConfirm={() => setUsersActiveAction({ ids: [user.id], isActive: false })}
        >
          <p>
            {user.fullName} sẽ bị đăng xuất ngay trên web, mọi thiết bị di động bị thu hồi và không
            đăng nhập được cho đến khi mở khoá.
          </p>
        </ConfirmDialog>
      ) : null}

      {dialog === 'UNLOCK' ? (
        <ConfirmDialog
          title="Mở khoá tài khoản"
          confirmLabel="Mở khoá"
          tone="primary"
          successMessage="Đã mở khoá tài khoản"
          onClose={closeDialog}
          onConfirm={() => setUsersActiveAction({ ids: [user.id], isActive: true })}
        >
          <p>{user.fullName} có thể đăng nhập lại. Thiết bị di động đã thu hồi cần đăng ký lại.</p>
        </ConfirmDialog>
      ) : null}

      {dialog === 'RESET' ? (
        <UserPasswordDialog userId={user.id} fullName={user.fullName} onClose={closeDialog} />
      ) : null}

      {dialog === 'IMPERSONATE' ? (
        <ConfirmDialog
          title="Đăng nhập thay"
          confirmLabel="Đăng nhập thay"
          tone="primary"
          successMessage="Đã chuyển sang tài khoản được chọn"
          onClose={closeDialog}
          onConfirm={() => startImpersonationAction(user.id)}
        >
          <p>
            Bạn sẽ thao tác với quyền của {user.fullName} trong tối đa 30 phút. Mọi thao tác đều ghi
            nhật ký kèm tên của bạn.
          </p>
        </ConfirmDialog>
      ) : null}
    </section>
  );
}
