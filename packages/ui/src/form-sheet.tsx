'use client';

import { X } from 'lucide-react';
import type { MouseEvent, ReactNode } from 'react';
import { useModalDialog } from './use-modal-dialog';

function closeParentDialog(event: MouseEvent<HTMLElement>) {
  event.currentTarget.closest('dialog')?.close();
}

type RootProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
};

// Dung dialog cua trinh duyet de co san khoa focus, phim Escape va nen mo.
function Root({ title, onClose, children }: RootProps) {
  const { attachDialog } = useModalDialog();

  return (
    <dialog
      ref={attachDialog}
      aria-label={title}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
      className="ml-auto h-dvh max-h-dvh w-full max-w-105 bg-surface text-text backdrop:bg-(--overlay)"
    >
      <div className="flex h-full flex-col overflow-y-auto p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-brand">{title}</h2>
          <button
            type="button"
            aria-label="Đóng"
            className="text-text-muted"
            onClick={closeParentDialog}
          >
            <X size={20} aria-hidden />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </dialog>
  );
}

function Close({ children }: { children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={closeParentDialog}
      className="h-9.5 rounded-md border border-brand bg-surface px-4 font-bold text-brand hover:bg-brand-soft"
    >
      {children}
    </button>
  );
}

export const FormSheet = { Root, Close };
