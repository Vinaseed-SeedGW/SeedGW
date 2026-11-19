import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LOCATION_CONSENT } from '@seedgw/contracts/consents';
import { AppFooter } from '@seedgw/ui/app-footer';
import { Logo } from '@seedgw/ui/logo';
import { LogoutButton } from '@/features/auth/components/logout-button';
import {
  acceptLocationConsentAction,
  declineLocationConsentAction,
} from '@/server/actions/consents';
import { getCurrentUser } from '@/server/auth/current-user';

export const metadata: Metadata = { title: 'Đồng ý chia sẻ vị trí' };

export default async function LocationConsentPage() {
  // Không dùng requireUser vì hàm đó chuyển người chưa đồng ý về chính trang này.
  const user = await getCurrentUser();
  if (!user) redirect('/api/session/expired');
  if (user.mustChangePassword) redirect('/doi-mat-khau');
  if (!user.needsLocationConsent) redirect('/hub');

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="bg-brand px-4 py-4 sm:px-6">
        <Logo variant="white" size="s" />
      </header>
      <main className="flex-1 px-4 py-8 sm:px-6">
        <article className="mx-auto grid max-w-2xl gap-5">
          <h1 className="text-2xl font-bold text-brand">{LOCATION_CONSENT.title}</h1>
          <p>{LOCATION_CONSENT.intro}</p>
          {LOCATION_CONSENT.sections.map((section) => (
            <section key={section.heading} className="grid gap-2">
              <h2 className="font-bold text-brand">{section.heading}</h2>
              <ul className="grid list-disc gap-1 pl-5">
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ))}
          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
            <form action={acceptLocationConsentAction}>
              <button
                type="submit"
                className="inline-flex h-11 items-center rounded-md bg-brand px-5 font-bold text-primary-foreground hover:bg-brand-hover"
              >
                {LOCATION_CONSENT.acceptLabel}
              </button>
            </form>
            <form action={declineLocationConsentAction}>
              <button
                type="submit"
                className="inline-flex h-11 items-center rounded-md border border-border bg-surface px-5 font-bold hover:bg-brand-soft"
              >
                {LOCATION_CONSENT.declineLabel}
              </button>
            </form>
            <div className="ml-auto">
              <LogoutButton />
            </div>
          </div>
          <p className="text-sm text-text-muted">
            Không đồng ý thì bạn vẫn dùng được trang web, nhưng không check-in được trên app. Lần
            đăng nhập sau hệ thống sẽ hỏi lại.
          </p>
        </article>
      </main>
      <AppFooter variant="full" />
    </div>
  );
}
