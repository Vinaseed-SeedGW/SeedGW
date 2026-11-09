'use client';

import { useState } from 'react';
import { useModalDialog } from '@dms/ui/use-modal-dialog';

type TemporaryPasswordDialogProps = {
  title: string;
  employeeCode: string;
  password: string;
  onClose: () => void;
};

const BUTTON_CLASS = 'h-9.5 rounded-md px-4 font-bold';

export function TemporaryPasswordDialog({
  title,
  employeeCode,
  password,
  onClose,
}: TemporaryPasswordDialogProps) {
  const { dialogRef, attachDialog } = useModalDialog();
  const [isCopied, setIsCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(password);
    setIsCopied(true);
  }

  return (
    <dialog
      ref={attachDialog}
      aria-label={title}
      onClose={onClose}
      className="m-auto w-full max-w-md rounded-md bg-surface p-5 text-text backdrop:bg-(--overlay)"
    >
      <h2 className="text-lg font-bold text-brand">{title}</h2>
      <p className="mt-2">
        Mã nhân viên: <b>{employeeCode}</b>
      </p>
      <p className="mt-2 rounded-md bg-brand-soft px-3 py-2 text-center text-xl font-bold break-all text-brand">
        {password}
      </p>
      <p className="mt-2 text-sm text-text-muted">
        Mật khẩu chỉ hiện một lần. Người dùng phải đổi mật khẩu ngay ở lần đăng nhập đầu tiên.
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          className={`${BUTTON_CLASS} border border-brand bg-surface text-brand hover:bg-brand-soft`}
          onClick={() => void copy()}
        >
          {isCopied ? 'Đã sao chép' : 'Sao chép'}
        </button>
        <button
          type="button"
          className={`${BUTTON_CLASS} bg-brand text-primary-foreground hover:bg-brand-hover`}
          onClick={() => dialogRef.current?.close()}
        >
          Đóng
        </button>
      </div>
    </dialog>
  );
}
