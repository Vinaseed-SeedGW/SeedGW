import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthPageLayout } from '@/features/auth/components/auth-page-layout';
import { ChangePasswordForm } from '@/features/auth/components/change-password-form';
import { LogoutButton } from '@/features/auth/components/logout-button';
import { getCurrentUser } from '@/server/auth/current-user';

export const metadata: Metadata = { title: 'Đổi mật khẩu' };

export default async function ChangePasswordPage() {
  // Khong dung requireUser vi ham do chuyen nguoi phai doi mat khau ve chinh trang nay.
  const user = await getCurrentUser();
  if (!user) redirect('/api/session/expired');
  if (user.impersonator) redirect('/hub');

  return (
    <AuthPageLayout title="Đổi mật khẩu">
      {user.mustChangePassword ? (
        <p className="mt-2 text-text-muted">
          Bạn cần đổi mật khẩu trước khi bắt đầu sử dụng hệ thống.
        </p>
      ) : null}
      <ChangePasswordForm />
      <div className="mt-4 text-center">
        <LogoutButton />
      </div>
    </AuthPageLayout>
  );
}
