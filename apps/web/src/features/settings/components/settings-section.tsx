import type { ReactNode } from 'react';

export function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-4 rounded-md border border-border bg-surface p-4 first:mt-0">
      <h2 className="mb-3 font-bold text-brand">{title}</h2>
      {children}
    </section>
  );
}
