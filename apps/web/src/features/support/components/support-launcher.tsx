import { supportButtonMode } from '@seedgw/contracts/access';
import {
  SupportButtonRequester,
  SupportButtonSystem,
  SupportButtonUnitHandler,
} from '@/features/support/components/support-button';
import { requireUser } from '@/server/auth/current-user';
import { getSupportButtonSummary } from '@/server/queries/support';

// Nút nổi Hỗ trợ cho mọi người (quyết định 32), đặt cuối khung trang. Chừa khoảng trống để nút không
// che chân trang khi cuộn hết.
export async function SupportLauncher() {
  const user = await requireUser();
  const mode = supportButtonMode(user.permissions, user.dataScope);
  if (!mode) return null;
  const initial = await getSupportButtonSummary();

  return (
    <>
      <div aria-hidden className="h-20 flex-none" />
      {mode === 'REQUESTER' ? <SupportButtonRequester initial={initial} /> : null}
      {mode === 'UNIT_HANDLER' ? <SupportButtonUnitHandler initial={initial} /> : null}
      {mode === 'SYSTEM_HANDLER' ? <SupportButtonSystem initial={initial} /> : null}
    </>
  );
}
