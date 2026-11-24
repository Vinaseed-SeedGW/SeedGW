'use client';

import { useState, useTransition, type ReactNode } from 'react';
import { cn } from './cn';
import { useToast } from './toast';
import { useModalDialog } from './use-modal-dialog';

type ConfirmResult =
  { ok: true; warnings?: Array<{ message: string }> } | { ok: false; message: string };

type ConfirmDialogProps = {
  title: string;
  confirmLabel: string;
  tone: 'primary' | 'danger';
  successMessage: string;
  onConfirm: () => Promise<ConfirmResult>;
  onClose: () => void;
  children: ReactNode;
};

const TONE_CLASS = {
  primary: 'bg-brand hover:bg-brand-hover',
  danger: 'bg-danger hover:opacity-90',
} as const;

export function ConfirmDialog({
  title,
  confirmLabel,
  tone,
  successMessage,
  onConfirm,
  onClose,
  children,
}: ConfirmDialogProps) {
  const { dialogRef, attachDialog } = useModalDialog();
  const { actions: toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleConfirm() {
    setErrorMessage(null);
    startTransition(async () => {
      const result = await onConfirm();
      if (result.ok) {
        toast.show({ tone: 'success', message: successMessage });
        result.warnings?.forEach(({ message }) => toast.show({ tone: 'warning', message }));
        dialogRef.current?.close();
      } else {
        setErrorMessage(result.message);
      }
    });
  }

  return (
    <dialog
      ref={attachDialog}
      aria-label={title}
      onClose={onClose}
      className="m-auto w-full max-w-md rounded-md bg-surface p-5 text-text backdrop:bg-(--overlay)"
    >
      <h2 className="text-lg font-bold text-brand">{title}</h2>
      <div className="mt-2">{children}</div>
      {errorMessage ? (
        <p role="alert" className="mt-3 rounded-md bg-danger-soft px-2.5 py-2 text-danger">
          {errorMessage}
        </p>
      ) : null}
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          className="h-9.5 rounded-md border border-brand bg-surface px-4 font-bold text-brand hover:bg-brand-soft"
          onClick={() => dialogRef.current?.close()}
        >
          Huỷ
        </button>
        <button
          type="button"
          disabled={isPending}
          className={cn(
            'h-9.5 rounded-md px-4 font-bold text-primary-foreground disabled:opacity-70',
            TONE_CLASS[tone],
          )}
          onClick={handleConfirm}
        >
          {isPending ? 'Đang xử lý...' : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
