import { FOOTER } from '@dms/config/footer';
import { cn } from './cn';
import { Logo } from './logo';

function Copyright() {
  return (
    <span>
      Bản quyền {/* Ky hieu nay trong font rat nho nen phai phong to, xem BRAND.md muc 2. */}
      <span className="align-[-0.4em] text-[2em] leading-[0]">©</span> {FOOTER.year} thuộc{' '}
      {FOOTER.department}
    </span>
  );
}

function Contact() {
  return (
    <span>
      Liên hệ {FOOTER.department}: Email{' '}
      <a className="text-brand" href={`mailto:${FOOTER.email}`}>
        {FOOTER.email}
      </a>
      , SĐT{' '}
      <a className="text-brand" href={`tel:${FOOTER.phone}`}>
        {FOOTER.phone}
      </a>
    </span>
  );
}

const FOOTER_CLASS =
  'border-border bg-surface text-text-muted flex flex-wrap items-center justify-between border-t text-sm';

export function AppFooter({ variant }: { variant: 'full' | 'compact' }) {
  if (variant === 'compact') {
    return (
      <footer className={cn(FOOTER_CLASS, 'gap-x-6 gap-y-1 px-5 py-2')}>
        <Copyright />
        <Contact />
      </footer>
    );
  }

  return (
    <footer className={cn(FOOTER_CLASS, 'gap-x-6 gap-y-2 px-6 py-3.5')}>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <Logo variant="color" size="s" />
        <Copyright />
      </div>
      <Contact />
    </footer>
  );
}
