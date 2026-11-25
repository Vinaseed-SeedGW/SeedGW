'use client';

import { Printer } from 'lucide-react';

/** Mở hộp in của trình duyệt; chọn "Lưu dưới dạng PDF" để có bản điện tử. */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-9.5 items-center gap-2 rounded-md bg-brand px-4 font-bold text-primary-foreground hover:bg-brand-hover print:hidden"
    >
      <Printer size={16} aria-hidden />
      In hoặc lưu PDF
    </button>
  );
}
