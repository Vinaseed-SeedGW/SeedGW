import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  ShellCollapseButton,
  ShellDeptSwitcher,
  ShellMenuButton,
  ShellNavItem,
  ShellRoot,
} from './app-shell-client';
import { Logo, LogoSymbol } from './logo';
import { MAIN_CONTENT_ID } from './skip-link';

type SlotProps = { children: ReactNode };

function Sidebar({ homeHref, children }: SlotProps & { homeHref: string }) {
  return (
    <aside className="app-sidebar" aria-label="Menu chính">
      <Link href={homeHref} className="app-sidebar-brand" aria-label="Về Hub">
        <span className="when-expanded">
          <Logo variant="white" size="m" />
        </span>
        <span className="when-collapsed">
          <LogoSymbol variant="white" width={32} />
        </span>
      </Link>
      <nav>{children}</nav>
      <ShellCollapseButton />
    </aside>
  );
}

function NavGroup({ label, children }: SlotProps & { label?: string }) {
  return (
    <div className="app-nav-group">
      {label ? <div className="app-nav-group-label when-expanded">{label}</div> : null}
      {children}
    </div>
  );
}

function Main({ children }: SlotProps) {
  return <div className="flex min-h-dvh min-w-0 flex-col">{children}</div>;
}

function Header({ children }: SlotProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 flex-none items-center gap-3 border-b border-border bg-surface px-5">
      <ShellMenuButton />
      {children}
    </header>
  );
}

function Breadcrumb({ children }: SlotProps) {
  return (
    <nav
      aria-label="Vị trí hiện tại"
      className="min-w-0 flex-1 truncate text-sm text-text-muted max-sm:invisible"
    >
      {children}
    </nav>
  );
}

function Content({ children }: SlotProps) {
  return (
    <main
      id={MAIN_CONTENT_ID}
      tabIndex={-1}
      className="min-w-0 flex-1 px-5 pt-4.5 pb-6 outline-none"
    >
      {children}
    </main>
  );
}

export const AppShell = {
  Root: ShellRoot,
  Sidebar,
  NavGroup,
  NavItem: ShellNavItem,
  Main,
  Header,
  Breadcrumb,
  DeptSwitcher: ShellDeptSwitcher,
  Content,
};
