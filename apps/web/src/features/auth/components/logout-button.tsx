import { LogOut } from 'lucide-react';
import { logoutAction } from '@/server/actions/auth';

export function LogoutButton() {
  return (
    <form action={logoutAction} className="flex-none">
      <button
        type="submit"
        aria-label="Đăng xuất"
        className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-1.5 text-brand"
      >
        <LogOut size={18} aria-hidden className="sm:hidden" />
        <span className="max-sm:sr-only">Đăng xuất</span>
      </button>
    </form>
  );
}
