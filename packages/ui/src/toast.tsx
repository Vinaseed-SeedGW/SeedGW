'use client';

import { createContext, use, useMemo, useState, type ReactNode } from 'react';
import { cn } from './cn';

const TOAST_DURATION_MS = 4000;

type ToastTone = 'success' | 'warning' | 'error';
type ToastItem = { id: number; tone: ToastTone; message: string };

type ToastContextValue = {
  state: { toasts: ToastItem[] };
  actions: {
    show: (toast: Omit<ToastItem, 'id'>) => void;
    dismiss: (id: number) => void;
  };
  meta: { durationMs: number };
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const value = use(ToastContext);
  if (!value) throw new Error('Component nay phai nam trong ToastProvider.');
  return value;
}

const TONE_CLASS: Record<ToastTone, string> = {
  success: 'bg-brand text-primary-foreground',
  warning: 'bg-warning text-text',
  error: 'bg-danger text-primary-foreground',
};

let nextToastId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const actions = useMemo<ToastContextValue['actions']>(() => {
    const dismiss = (id: number) => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    };
    return {
      dismiss,
      show: (toast) => {
        const id = nextToastId++;
        setToasts((current) => [...current, { ...toast, id }]);
        setTimeout(() => dismiss(id), TOAST_DURATION_MS);
      },
    };
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({ state: { toasts }, actions, meta: { durationMs: TOAST_DURATION_MS } }),
    [toasts, actions],
  );

  return (
    <ToastContext value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="fixed right-4 bottom-4 z-50 flex max-w-[calc(100vw-2rem)] flex-col gap-2"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn('rounded-md px-4 py-2.5 font-bold shadow-md', TONE_CLASS[toast.tone])}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext>
  );
}
