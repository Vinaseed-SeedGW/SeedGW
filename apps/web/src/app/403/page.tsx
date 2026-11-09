import type { Metadata } from 'next';
import Link from 'next/link';
import { AppFooter } from '@dms/ui/app-footer';
import { Logo } from '@dms/ui/logo';

export const metadata: Metadata = { title: 'Không có quyền' };

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <main className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <Logo variant="color" size="l" />
        <h1 className="mt-4 text-2xl font-bold text-brand">
          Bạn không có quyền truy cập trang này
        </h1>
        <p className="text-text-muted">
          Nếu cần sử dụng chức năng này, vui lòng liên hệ quản trị hệ thống.
        </p>
        <Link href="/hub" className="font-bold text-brand">
          Về Hub
        </Link>
      </main>
      <AppFooter variant="full" />
    </div>
  );
}
