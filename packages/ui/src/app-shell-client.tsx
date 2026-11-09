'use client';

import { ChevronDown, Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  createContext,
  use,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { SIDEBAR_STORAGE_KEY } from './sidebar-storage';
import { useDismissable } from './use-dismissable';

type ShellContextValue = {
  state: { collapsed: boolean; drawerOpen: boolean };
  actions: { toggleCollapsed: () => void; openDrawer: () => void; closeDrawer: () => void };
  meta: { storageKey: string };
};

const ShellContext = createContext<ShellContextValue | null>(null);

function useShell(): ShellContextValue {
  const value = use(ShellContext);
  if (!value) throw new Error('Component nay phai nam trong AppShell.Root.');
  return value;
}

// Trang thai thu gon nam tren the html, do script dau trang dat truoc khi ve.
const collapseListeners = new Set<() => void>();

function subscribeCollapsed(listener: () => void) {
  collapseListeners.add(listener);
  return () => {
    collapseListeners.delete(listener);
  };
}

function readCollapsed() {
  return document.documentElement.dataset.sidebar === 'collapsed';
}

function readCollapsedOnServer() {
  return false;
}

function toggleCollapsed() {
  const next = !readCollapsed();
  if (next) document.documentElement.dataset.sidebar = 'collapsed';
  else delete document.documentElement.dataset.sidebar;
  try {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? 'collapsed' : 'expanded');
  } catch {
    // Trinh duyet chan bo nho thi van thu gon duoc, chi khong nho lai.
  }
  collapseListeners.forEach((listener) => listener());
}

export function ShellRoot({ children }: { children: ReactNode }) {
  const collapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, readCollapsedOnServer);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (!drawerOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [drawerOpen]);

  const actions = useMemo<ShellContextValue['actions']>(
    () => ({
      toggleCollapsed,
      openDrawer: () => setDrawerOpen(true),
      closeDrawer: () => setDrawerOpen(false),
    }),
    [],
  );

  const value = useMemo<ShellContextValue>(
    () => ({
      state: { collapsed, drawerOpen },
      actions,
      meta: { storageKey: SIDEBAR_STORAGE_KEY },
    }),
    [collapsed, drawerOpen, actions],
  );

  return (
    <ShellContext value={value}>
      <div className="app-shell" data-drawer={drawerOpen ? 'open' : 'closed'}>
        {children}
        <button
          type="button"
          className="app-drawer-backdrop"
          aria-label="Đóng menu"
          onClick={value.actions.closeDrawer}
        />
      </div>
    </ShellContext>
  );
}

export function ShellMenuButton() {
  const { actions } = useShell();
  return (
    <button
      type="button"
      className="app-menu-button flex-none items-center justify-center p-1 text-brand"
      aria-label="Mở menu"
      onClick={actions.openDrawer}
    >
      <Menu size={22} aria-hidden />
    </button>
  );
}

export function ShellCollapseButton() {
  const { state, actions } = useShell();
  const Icon = state.collapsed ? PanelLeftOpen : PanelLeftClose;
  const label = state.collapsed ? 'Mở rộng menu' : 'Thu gọn menu';
  return (
    <button
      type="button"
      className="app-collapse"
      aria-label={label}
      title={label}
      onClick={actions.toggleCollapsed}
    >
      <Icon aria-hidden />
      <span className="when-expanded">Thu gọn</span>
    </button>
  );
}

type ShellNavItemProps = {
  href: string;
  label: string;
  children: ReactNode;
};

export function ShellNavItem({ href, label, children }: ShellNavItemProps) {
  const pathname = usePathname();
  const { actions } = useShell();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      className="app-nav-item"
      aria-label={label}
      aria-current={isActive ? 'page' : undefined}
      title={label}
      onClick={actions.closeDrawer}
    >
      {children}
      <span className="when-expanded">{label}</span>
    </Link>
  );
}

type ShellDeptSwitcherProps = {
  label: string;
  children: ReactNode;
};

export function ShellDeptSwitcher({ label, children }: ShellDeptSwitcherProps) {
  const { open, setOpen, containerRef } = useDismissable();

  return (
    <div ref={containerRef} className="relative flex-none">
      <button
        type="button"
        className="flex items-center gap-1 font-bold text-brand"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((current) => !current)}
      >
        {label}
        <ChevronDown size={16} aria-hidden />
      </button>
      {open ? (
        <div
          className="absolute top-full right-0 z-50 mt-2 min-w-48 rounded-md border border-border bg-surface p-1 shadow-md"
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
