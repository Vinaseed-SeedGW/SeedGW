'use client';

import { useTransition } from 'react';
import { useToast } from '@dms/ui/toast';
import { rematchDealerAssigneesAction } from '@/server/actions/dealers';

/** Dùng sau khi nhập thêm tài khoản: ghép đại lý đang chờ gán với nhân viên theo tên ghi trên DMS cũ. */
export function RematchAssigneesButton() {
  const { actions: toast } = useToast();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      className="inline-flex h-9.5 items-center rounded-md border border-brand bg-surface px-4 font-bold text-brand hover:bg-brand-soft disabled:opacity-60"
      onClick={() =>
        startTransition(async () => {
          const result = await rematchDealerAssigneesAction();
          toast.show(
            result.ok
              ? {
                  tone: result.data.matched > 0 ? 'success' : 'warning',
                  message:
                    result.data.matched > 0
                      ? `Đã gán nhân viên cho ${result.data.matched} đại lý`
                      : 'Không ghép thêm được đại lý nào. Kiểm tra tên tài khoản có khớp tên trên DMS cũ không',
                }
              : { tone: 'error', message: result.message },
          );
        })
      }
    >
      {isPending ? 'Đang ghép' : 'Ghép nhân viên theo tên'}
    </button>
  );
}
