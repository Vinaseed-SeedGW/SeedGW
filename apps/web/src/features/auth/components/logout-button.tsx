import { logoutAction } from '@/server/actions/auth';

export function LogoutButton() {
  return (
    <form action={logoutAction} className="flex-none">
      <button type="submit" className="text-brand">
        Đăng xuất
      </button>
    </form>
  );
}
