import { LoginForm } from '@/features/auth/components/login-form';

type LoginPageProps = {
  searchParams: Promise<{ callbackUrl?: string | string[] }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { callbackUrl } = await searchParams;

  return (
    <main style={{ maxWidth: 340, margin: '80px auto', padding: 16 }}>
      <h1>Đăng nhập</h1>
      <LoginForm callbackUrl={typeof callbackUrl === 'string' ? callbackUrl : undefined} />
    </main>
  );
}
