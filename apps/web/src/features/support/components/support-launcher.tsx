import { showsSupportButton } from '@dms/contracts/access';
import { SupportButton } from '@/features/support/components/support-button';
import { requireUser } from '@/server/auth/current-user';

// Dat cuoi khung trang. Chua cho nut noi khoang trong de khong che chan trang khi cuon het.
export async function SupportLauncher() {
  const user = await requireUser();
  if (!showsSupportButton(user.permissions)) return null;

  return (
    <>
      <div aria-hidden className="h-20 flex-none" />
      <SupportButton />
    </>
  );
}
