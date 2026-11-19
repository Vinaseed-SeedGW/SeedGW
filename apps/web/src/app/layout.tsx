import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SIDEBAR_INIT_SCRIPT } from '@seedgw/ui/sidebar-storage';
import { ToastProvider } from '@seedgw/ui/toast';
import { brandFont } from './fonts';
import './globals.css';
import { APP_NAME } from '@seedgw/config/brand';

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s - ${APP_NAME}` },
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
