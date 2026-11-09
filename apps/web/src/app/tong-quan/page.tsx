import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppFooter } from '@dms/ui/app-footer';
import { Logo } from '@dms/ui/logo';
import { LogoutButton } from '@/features/auth/components/logout-button';
import { requireUser } from '@/server/auth/current-user';
import { canViewExecutive, getRoleCodes } from '@/server/auth/roles';

export const metadata: Metadata = { title: 'Tổng quan điều hành' };

export default async function ExecutivePage() {
  const user = await requireUser();
  if (!canViewExecutive(await getRoleCodes(user.id))) redirect('/hub');

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-16 flex-none items-center justify-between gap-4 border-b border-border px-4 sm:px-6">
        <Link href="/hub" aria-label="Về Hub" className="flex-none">
          <Logo variant="color" size="m" />
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/hub" className="font-bold text-brand">
            Về Hub
          </Link>
          <LogoutButton />
        </div>
      </header>
      <main className="flex-1 px-4 py-9 sm:px-6">
        <h1 className="text-2xl font-bold text-brand">Tổng quan điều hành</h1>
        <p className="mt-2 text-text-muted">Chức năng này đang được xây dựng.</p>
      </main>
      <AppFooter variant="full" />
    </div>
  );
}
