'use client';

import { AppFooter } from '@dms/ui/app-footer';
import { Logo } from '@dms/ui/logo';

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <main className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <Logo variant="color" size="l" />
        <h1 className="mt-4 text-2xl font-bold text-brand">Đã xảy ra lỗi</h1>
        <p className="text-text-muted">Hệ thống chưa xử lý được yêu cầu này. Vui lòng thử lại.</p>
        <button type="button" className="font-bold text-brand" onClick={reset}>
          Thử lại
        </button>
      </main>
      <AppFooter variant="full" />
    </div>
  );
}
