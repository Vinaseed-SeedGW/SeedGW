import Link from 'next/link';
import type { ReactNode } from 'react';
import { AppFooter } from '@seedgw/ui/app-footer';
import { Logo } from '@seedgw/ui/logo';
import { MAIN_CONTENT_ID, SkipLink } from '@seedgw/ui/skip-link';
import { LogoutButton } from '@/features/auth/components/logout-button';
import { GlobalSearch } from '@/features/shell/components/global-search';
import { ImpersonationBanner } from '@/features/shell/components/impersonation-banner';
import type { SearchPage } from '@seedgw/contracts/search';
import { SupportLauncher } from '@/features/support/components/support-launcher';

type HubLayoutProps = {
  userName: string;
  searchPages: SearchPage[];
  children: ReactNode;
};

export function HubLayout({ userName, searchPages, children }: HubLayoutProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <ImpersonationBanner />
      <header className="flex h-16 flex-none items-center justify-between gap-4 border-b border-border px-4 sm:px-6">
        <Link href="/hub" aria-label="Về Hub" className="flex-none">
          <Logo variant="color" size="m" />
        </Link>
        <div className="flex min-w-0 items-center gap-4">
          <GlobalSearch pages={searchPages} />
          <span className="hidden truncate sm:inline">{userName}</span>
          <LogoutButton />
        </div>
      </header>
      <main
        id={MAIN_CONTENT_ID}
        tabIndex={-1}
        className="flex-1 bg-surface-subtle px-4 py-9 outline-none sm:px-6"
      >
        <div className="mx-auto max-w-270">{children}</div>
      </main>
      <AppFooter variant="full" />
      <SupportLauncher />
    </div>
  );
}
