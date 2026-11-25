import Link from 'next/link';
import type { ReactNode } from 'react';
import { AppFooter } from '@seedgw/ui/app-footer';
import { Logo } from '@seedgw/ui/logo';
import { MAIN_CONTENT_ID, SkipLink } from '@seedgw/ui/skip-link';
import { LogoutButton } from '@/features/auth/components/logout-button';

/**
 * Khung trang đồng ý: không có chuông thông báo hay tìm nhanh, vì các phần đó đòi đã đồng ý; người đã rút
 * lại vẫn phải xem được sổ đồng ý và giấy xác nhận của mình.
 */
export function ConsentPageFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <header className="flex h-16 flex-none items-center justify-between gap-4 border-b border-border px-4 sm:px-6">
        <Link href="/hub" aria-label="Về Hub" className="flex-none">
          <Logo variant="color" size="m" />
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/hub" className="font-bold text-brand hover:underline">
            Về Hub
          </Link>
          <LogoutButton />
        </div>
      </header>
      <main
        id={MAIN_CONTENT_ID}
        tabIndex={-1}
        className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 outline-none sm:px-6"
      >
        {children}
      </main>
      <AppFooter variant="full" />
    </div>
  );
}
