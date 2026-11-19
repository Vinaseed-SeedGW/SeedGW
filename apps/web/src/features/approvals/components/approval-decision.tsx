'use client';

import { useState } from 'react';
import type { ActionResult } from '@seedgw/contracts/common';
import { ConfirmDialog } from '@seedgw/ui/confirm-dialog';
import {
  approveApprovalAction,
  returnApprovalAction,
  withdrawApprovalAction,
} from '@/server/actions/approvals';

const PRIMARY_BUTTON =
  'inline-flex h-9.5 items-center rounded-md bg-brand px-4 font-bold text-primary-foreground hover:bg-brand-hover';
const SECONDARY_BUTTON =
  'inline-flex h-9.5 items-center rounded-md border border-border bg-surface px-4 font-bold hover:bg-brand-soft';
const TEXTAREA = 'mt-1 min-h-24 w-full rounded-md border border-border bg-surface p-2';

// Lỗi kiểm tra trường hiện đúng câu của trường thay cho câu chung.
function toConfirmResult<T>(result: ActionResult<T>, field?: string) {
  if (result.ok) return { ok: true as const };
  const fieldMessage = field ? result.fieldErrors?.[field] : undefined;
  return { ok: false as const, message: fieldMessage ?? result.message };
}

/** Nút Duyệt, Trả lại cho người đang được giao duyệt phiếu. */
export function ApprovalReviewButtons({ code }: { code: string }) {
  const [dialog, setDialog] = useState<'approve' | 'return' | null>(null);
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const close = () => setDialog(null);

  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" className={PRIMARY_BUTTON} onClick={() => setDialog('approve')}>
        Duyệt
      </button>
      <button type="button" className={SECONDARY_BUTTON} onClick={() => setDialog('return')}>
        Trả lại
      </button>
      {dialog === 'approve' ? (
        <ConfirmDialog
          title={`Duyệt phiếu ${code}`}
          confirmLabel="Duyệt"
          tone="primary"
          successMessage={`Đã duyệt phiếu ${code}`}
          onClose={close}
          onConfirm={async () =>
            toConfirmResult(await approveApprovalAction({ code, note }), 'note')
          }
        >
          <label className="block font-bold" htmlFor="approve-note">
            Ghi chú (không bắt buộc)
          </label>
          <textarea
            id="approve-note"
            value={note}
            maxLength={500}
            onChange={(event) => setNote(event.target.value)}
            className={TEXTAREA}
          />
        </ConfirmDialog>
      ) : null}

      {dialog === 'return' ? (
        <ConfirmDialog
          title={`Trả lại phiếu ${code}`}
          confirmLabel="Trả lại"
          tone="danger"
          successMessage={`Đã trả lại phiếu ${code}`}
          onClose={close}
          onConfirm={async () =>
            toConfirmResult(await returnApprovalAction({ code, reason }), 'reason')
          }
        >
          <p>Người gửi sẽ thấy lý do, sửa rồi gửi lại từ đầu.</p>
          <label className="mt-3 block font-bold" htmlFor="return-reason">
            Lý do trả lại
          </label>
          <textarea
            id="return-reason"
            value={reason}
            maxLength={500}
            required
            aria-describedby="return-reason-hint"
            onChange={(event) => setReason(event.target.value)}
            className={TEXTAREA}
          />
          <p id="return-reason-hint" className="mt-1 text-sm text-text-muted">
            Từ 5 đến 500 ký tự.
          </p>
        </ConfirmDialog>
      ) : null}
    </div>
  );
}

/** Người gửi rút lại phiếu khi chưa ai duyệt. */
export function ApprovalWithdrawButton({ code }: { code: string }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <>
      <button type="button" className={SECONDARY_BUTTON} onClick={() => setOpen(true)}>
        Rút lại phiếu
      </button>
      {open ? (
        <ConfirmDialog
          title={`Rút lại phiếu ${code}`}
          confirmLabel="Rút lại"
          tone="danger"
          successMessage={`Đã rút lại phiếu ${code}`}
          onClose={close}
          onConfirm={async () => toConfirmResult(await withdrawApprovalAction({ code }))}
        >
          <p>
            Phiếu không còn chờ duyệt. Bạn sửa rồi gửi lại khi cần; chỉ tiêu đã duyệt trước đó (nếu
            có) vẫn giữ hiệu lực.
          </p>
        </ConfirmDialog>
      ) : null}
    </>
  );
}
