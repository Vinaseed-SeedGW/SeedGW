'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { ActionResult } from '@dms/contracts/common';
import {
  SUPPORT_STATUS_LABEL,
  supportManualStatus,
  type SupportDetail,
  type SupportManualStatus,
} from '@dms/contracts/support';
import { ConfirmDialog } from '@dms/ui/confirm-dialog';
import { useToast } from '@dms/ui/toast';
import {
  changeSupportStatusAction,
  claimSupportAction,
  escalateSupportAction,
} from '@/server/actions/support';
import { SupportThread } from './support-thread';

const PRIMARY_BUTTON =
  'inline-flex h-9.5 items-center rounded-md bg-brand px-4 font-bold text-primary-foreground hover:bg-brand-hover disabled:opacity-70';
const SECONDARY_BUTTON =
  'inline-flex h-9.5 items-center rounded-md border border-border bg-surface px-4 font-bold hover:bg-brand-soft';
const TEXTAREA = 'mt-1 min-h-20 w-full rounded-md border border-border bg-surface p-2';

const toConfirm = (result: ActionResult<unknown>) =>
  result.ok ? { ok: true as const } : { ok: false as const, message: result.message };

/** Nhận xử lý, Chuyển lên, đổi trạng thái cho Quản trị đơn vị và Quản trị hệ thống. */
export function SupportHandlerActions({ detail }: { detail: SupportDetail }) {
  const router = useRouter();
  const { actions: toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<'escalate' | SupportManualStatus | null>(null);
  const [note, setNote] = useState('');
  const close = () => {
    setDialog(null);
    setNote('');
    router.refresh();
  };
  const statuses = supportManualStatus.options.filter((status) => status !== detail.status);

  function claim() {
    startTransition(async () => {
      const result = await claimSupportAction({ code: detail.code });
      toast.show(
        result.ok
          ? { tone: 'success', message: `Đã nhận xử lý ${detail.code}` }
          : { tone: 'error', message: result.message },
      );
      router.refresh();
    });
  }

  return (
    <div className="grid gap-2">
      {detail.actions.canClaim ? (
        <button type="button" className={PRIMARY_BUTTON} disabled={isPending} onClick={claim}>
          Nhận xử lý
        </button>
      ) : null}
      {detail.actions.canChangeStatus ? (
        <div className="flex flex-wrap gap-2">
          {statuses.map((status) => (
            <button
              key={status}
              type="button"
              className={SECONDARY_BUTTON}
              onClick={() => setDialog(status)}
            >
              {status === 'DONE'
                ? 'Đánh dấu Đã xong'
                : `Chuyển sang ${SUPPORT_STATUS_LABEL[status]}`}
            </button>
          ))}
        </div>
      ) : null}
      {detail.actions.canEscalate ? (
        <button type="button" className={SECONDARY_BUTTON} onClick={() => setDialog('escalate')}>
          Chuyển lên Quản trị hệ thống
        </button>
      ) : null}

      {dialog === 'escalate' ? (
        <ConfirmDialog
          title={`Chuyển ${detail.code} lên Quản trị hệ thống`}
          confirmLabel="Chuyển lên"
          tone="primary"
          successMessage={`Đã chuyển ${detail.code} lên Quản trị hệ thống`}
          onClose={close}
          onConfirm={async () =>
            toConfirm(await escalateSupportAction({ code: detail.code, note }))
          }
        >
          <p>Quản trị hệ thống nhận như yêu cầu mới. Bạn vẫn xem và trao đổi được trong yêu cầu.</p>
          <label className="mt-3 block font-bold" htmlFor="escalate-note">
            Ghi chú cho Quản trị hệ thống (không bắt buộc)
          </label>
          <textarea
            id="escalate-note"
            value={note}
            maxLength={500}
            onChange={(event) => setNote(event.target.value)}
            className={TEXTAREA}
          />
        </ConfirmDialog>
      ) : null}

      {dialog && dialog !== 'escalate' ? (
        <ConfirmDialog
          title={`Chuyển ${detail.code} sang ${SUPPORT_STATUS_LABEL[dialog]}`}
          confirmLabel="Đổi trạng thái"
          tone="primary"
          successMessage={`Đã chuyển ${detail.code} sang ${SUPPORT_STATUS_LABEL[dialog]}`}
          onClose={close}
          onConfirm={async () =>
            toConfirm(await changeSupportStatusAction({ code: detail.code, status: dialog, note }))
          }
        >
          {dialog === 'DONE' ? (
            <p>Người gửi được Mở lại trong 7 ngày; quá 7 ngày yêu cầu tự đóng.</p>
          ) : dialog === 'WAITING_REQUESTER' ? (
            <p>
              Dùng khi cần người gửi bổ sung thông tin. Thời hạn tạm dừng tới khi người gửi trả lời.
            </p>
          ) : null}
          <label className="mt-3 block font-bold" htmlFor="status-note">
            Ghi chú (không bắt buộc)
          </label>
          <textarea
            id="status-note"
            value={note}
            maxLength={500}
            onChange={(event) => setNote(event.target.value)}
            className={TEXTAREA}
          />
        </ConfirmDialog>
      ) : null}
    </div>
  );
}

/** Ô trả lời ở trang quản trị: gửi xong thì tải lại trang. */
export function SupportHandlerComposer({ code }: { code: string }) {
  const router = useRouter();
  return <SupportThread.Composer code={code} onSent={() => router.refresh()} />;
}
