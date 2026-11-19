'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { useToast } from '@seedgw/ui/toast';
import { syncFastNowAction } from '@/server/actions/fast';

/** Nút Đồng bộ ngay: xếp việc cho worker, vài giây sau tải lại để thấy lần chạy mới. */
export function FastSyncNowButton() {
  const router = useRouter();
  const { actions: toast } = useToast();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await syncFastNowAction();
          if (!result.ok) {
            toast.show({ tone: 'error', message: result.message });
            return;
          }
          toast.show({
            tone: 'success',
            message: 'Đã xếp lịch đồng bộ, kết quả hiện trong vài giây',
          });
          setTimeout(() => router.refresh(), 4000);
        })
      }
      className="h-9.5 rounded-md bg-brand px-4 font-bold text-primary-foreground hover:bg-brand-hover disabled:opacity-70"
    >
      {pending ? 'Đang xếp lịch...' : 'Đồng bộ ngay'}
    </button>
  );
}
