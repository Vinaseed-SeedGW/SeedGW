import Link from 'next/link';
import type { ReactNode } from 'react';

type FormPageProps = {
  title: string;
  backHref: string;
  backLabel: string;
  children: ReactNode;
};

export function FormPage({ title, backHref, backLabel, children }: FormPageProps) {
  return (
    <div className="max-w-2xl">
      <Link href={backHref} className="text-sm text-brand">
        {backLabel}
      </Link>
      <h1 className="mt-1 text-2xl font-bold text-brand">{title}</h1>
      <div className="mt-4">{children}</div>
    </div>
  );
}
