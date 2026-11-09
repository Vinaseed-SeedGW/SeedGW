import { logoutAction } from '@/server/actions/auth';

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button type="submit">Đăng xuất</button>
    </form>
  );
}
