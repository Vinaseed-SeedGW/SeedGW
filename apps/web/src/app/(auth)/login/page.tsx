import type { Metadata } from 'next';
import { AppFooter } from '@dms/ui/app-footer';
import { Logo } from '@dms/ui/logo';
import { LoginForm } from '@/features/auth/components/login-form';

export const metadata: Metadata = { title: 'Đăng nhập' };

type LoginPageProps = {
  searchParams: Promise<{ callbackUrl?: string | string[] }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { callbackUrl } = await searchParams;

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="grid flex-1 grid-cols-[minmax(0,1fr)] md:grid-cols-[5fr_6fr]">
        <section className="flex flex-col justify-between gap-10 bg-brand p-6 text-primary-foreground md:p-12">
          <Logo variant="white" size="xl" />
          <p className="max-w-85 text-2xl font-bold">Hệ thống quản lý phân phối</p>
        </section>
        <main className="flex items-center justify-center px-6 py-8">
          <div className="w-full max-w-85">
            <h1 className="text-2xl font-bold text-brand">Đăng nhập</h1>
            <LoginForm callbackUrl={typeof callbackUrl === 'string' ? callbackUrl : undefined} />
          </div>
        </main>
      </div>
      <AppFooter variant="full" />
    </div>
  );
}
