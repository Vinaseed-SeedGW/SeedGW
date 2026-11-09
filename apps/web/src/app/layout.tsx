import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SIDEBAR_INIT_SCRIPT } from '@dms/ui/sidebar-storage';
import { ToastProvider } from '@dms/ui/toast';
import { brandFont } from './fonts';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'DMS Vinaseed', template: '%s - DMS Vinaseed' },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi" className={brandFont.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SIDEBAR_INIT_SCRIPT }} />
      </head>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
