'use client';

import { useState } from 'react';
import { ConfirmDialog } from '@dms/ui/confirm-dialog';
import { useDataTable } from '@dms/ui/data-table';
import { useToast } from '@dms/ui/toast';
import { setUsersActiveAction } from '@/server/actions/users';

type BulkMode = 'LOCK' | 'UNLOCK';

const MODE_TEXT = {
  LOCK: {
    title: 'Khoá tài khoản đã chọn',
    confirm: 'Khoá',
    success: 'Đã khoá các tài khoản đã chọn',
    body: 'Các tài khoản này sẽ bị đăng xuất ngay và mọi thiết bị di động bị thu hồi.',
  },
  UNLOCK: {
    title: 'Mở khoá tài khoản đã chọn',
    confirm: 'Mở khoá',
    success: 'Đã mở khoá các tài khoản đã chọn',
    body: 'Người dùng có thể đăng nhập lại. Thiết bị di động đã thu hồi cần đăng ký lại.',
  },
} as const;

export function UsersBulkActions() {
  const { state, actions } = useDataTable();
  const { actions: toast } = useToast();
  const [mode, setMode] = useState<BulkMode | null>(null);
  const text = mode ? MODE_TEXT[mode] : null;

  return (
    <>
      <button type="button" className="text-danger" onClick={() => setMode('LOCK')}>
        Khoá
      </button>
      <button type="button" className="text-brand" onClick={() => setMode('UNLOCK')}>
        Mở khoá
      </button>
      {mode && text ? (
        <ConfirmDialog
          title={text.title}
          confirmLabel={text.confirm}
          tone={mode === 'LOCK' ? 'danger' : 'primary'}
          successMessage={text.success}
          onClose={() => setMode(null)}
          onConfirm={async () => {
            const result = await setUsersActiveAction({
              ids: state.selectedIds,
              isActive: mode === 'UNLOCK',
            });
            if (result.ok) {
              actions.clearSelection();
              if (result.data.skipped > 0) {
                toast.show({
                  tone: 'warning',
                  message: `Bỏ qua ${result.data.skipped} tài khoản không cần đổi hoặc không được phép`,
                });
              }
            }
            return result;
          }}
        >
          <p>
            Áp dụng cho {state.selectedIds.length} tài khoản. {text.body}
          </p>
        </ConfirmDialog>
      ) : null}
    </>
  );
}
