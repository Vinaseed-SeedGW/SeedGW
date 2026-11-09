import { stopImpersonationAction } from '@/server/actions/users';
import { getCurrentUser } from '@/server/auth/current-user';

export async function ImpersonationBanner() {
  const user = await getCurrentUser();
  if (!user?.impersonator) return null;

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-danger-soft px-4 py-2 text-danger"
    >
      <span>
        {user.impersonator.fullName} đang đăng nhập thay <b>{user.fullName}</b>. Mọi thao tác đều
        được ghi nhật ký.
      </span>
      <form action={stopImpersonationAction}>
        <button type="submit" className="font-bold">
          Thoát đăng nhập thay
        </button>
      </form>
    </div>
  );
}
