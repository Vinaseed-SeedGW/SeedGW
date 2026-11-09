import type { Metadata } from 'next';
import { AuthPageLayout } from '@/features/auth/components/auth-page-layout';
import { LoginForm } from '@/features/auth/components/login-form';

export const metadata: Metadata = { title: 'Đăng nhập' };

type LoginPageProps = {
  searchParams: Promise<{ callbackUrl?: string | string[] }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { callbackUrl } = await searchParams;

  return (
    <AuthPageLayout title="Đăng nhập">
      <LoginForm callbackUrl={typeof callbackUrl === 'string' ? callbackUrl : undefined} />
    </AuthPageLayout>
  );
}
