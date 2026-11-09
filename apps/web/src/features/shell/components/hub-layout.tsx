import Link from 'next/link';
import type { ReactNode } from 'react';
import { AppFooter } from '@dms/ui/app-footer';
import { Logo } from '@dms/ui/logo';
import { LogoutButton } from '@/features/auth/components/logout-button';
import { ImpersonationBanner } from '@/features/shell/components/impersonation-banner';

type HubLayoutProps = {
  userName: string;
  children: ReactNode;
};

export function HubLayout({ userName, children }: HubLayoutProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <ImpersonationBanner />
      <header className="flex h-16 flex-none items-center justify-between gap-4 border-b border-border px-4 sm:px-6">
        <Link href="/hub" aria-label="Về Hub" className="flex-none">
          <Logo variant="color" size="m" />
        </Link>
        <div className="flex min-w-0 items-center gap-4">
          <span className="hidden truncate sm:inline">{userName}</span>
          <LogoutButton />
        </div>
      </header>
      <main className="flex-1 bg-surface-subtle px-4 py-9 sm:px-6">
        <div className="mx-auto max-w-270">{children}</div>
      </main>
      <AppFooter variant="full" />
    </div>
  );
}
