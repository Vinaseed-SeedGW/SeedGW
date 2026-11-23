import 'server-only';
import type { SeasonRow } from '@seedgw/contracts/seasons';
import { requireUser } from '@/server/auth/current-user';
import { listSeasons } from '@/server/services/seasons';

/** Lịch vụ cho trang Quản trị và ô chọn kỳ Vụ; ai đăng nhập cũng đọc được (lịch chung toàn công ty). */
export async function getSeasons(): Promise<SeasonRow[]> {
  await requireUser();
  return listSeasons();
}
