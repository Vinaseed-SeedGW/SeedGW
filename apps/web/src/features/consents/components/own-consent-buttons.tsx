'use client';

import { useState, useTransition } from 'react';
import { ConfirmDialog } from '@seedgw/ui/confirm-dialog';
import { changeOwnLocationConsentAction } from '@/server/actions/consents';

const PRIMARY =
  'h-9.5 rounded-md bg-brand px-4 font-bold text-primary-foreground hover:bg-brand-hover disabled:opacity-70';
const DANGER =
  'h-9.5 rounded-md border border-danger bg-surface px-4 font-bold text-danger hover:bg-danger-soft';

/** Đồng ý hoặc rút lại ngay trên web; rút lại phải xác nhận vì app sẽ dừng ghi vị trí. */
export function OwnConsentButtons({ accepted }: { accepted: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function accept() {
    setError(null);
    startTransition(async () => {
      const result = await changeOwnLocationConsentAction(true);
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <div className="mt-3">
      {accepted ? (
        <button type="button" className={DANGER} onClick={() => setConfirming(true)}>
          Rút lại đồng ý
        </button>
      ) : (
        <button type="button" className={PRIMARY} disabled={isPending} onClick={accept}>
          {isPending ? 'Đang ghi...' : 'Tôi đồng ý'}
        </button>
      )}
      {error ? (
        <p role="alert" className="mt-2 text-danger">
          {error}
        </p>
      ) : null}
      {confirming ? (
        <ConfirmDialog
          title="Rút lại đồng ý chia sẻ vị trí"
          confirmLabel="Rút lại"
          tone="danger"
          successMessage="Đã rút lại đồng ý"
          onClose={() => setConfirming(false)}
          onConfirm={() => changeOwnLocationConsentAction(false)}
        >
          <p>
            App sẽ dừng ghi vị trí và bạn không check-in trên app được nữa cho tới khi đồng ý lại.
            Lần rút lại này được ghi vào sổ đồng ý.
          </p>
        </ConfirmDialog>
      ) : null}
    </div>
  );
}
