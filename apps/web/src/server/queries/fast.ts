import 'server-only';
import type { FastOverview } from '@seedgw/contracts/fast';
import { assertCan } from '@/server/auth/can';
import { requireUser } from '@/server/auth/current-user';
import { readFastOverview } from '@/server/services/fast';

export async function getFastOverview(): Promise<FastOverview> {
  const user = await requireUser();
  assertCan(user, 'admin.connection.read');
  return readFastOverview();
}
