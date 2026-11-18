import { showsSupportButton } from '@dms/contracts/access';
import { SupportButton } from '@/features/support/components/support-button';
import { requireUser } from '@/server/auth/current-user';
import { getMySupportBadge } from '@/server/queries/support';

// Đặt cuối khung trang. Chừa khoảng trống để nút nổi không che chân trang khi cuộn hết.
export async function SupportLauncher() {
  const user = await requireUser();
  if (!showsSupportButton(user.permissions)) return null;

  return (
    <>
      <div aria-hidden className="h-20 flex-none" />
      <SupportButton initialCount={await getMySupportBadge()} />
    </>
  );
}
