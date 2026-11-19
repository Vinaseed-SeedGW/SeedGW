import 'server-only';
import type { SettingsOverview } from '@seedgw/contracts/settings';
import { assertCan } from '@/server/auth/can';
import { requireUser } from '@/server/auth/current-user';
import { readDealerCodeSequence, readSystemSettings } from '@/server/services/settings';

export async function getSettingsOverview(): Promise<SettingsOverview> {
  const user = await requireUser();
  assertCan(user, 'admin.setting.read');

  const [settings, codeSequence] = await Promise.all([
    readSystemSettings(),
    readDealerCodeSequence(),
  ]);
  return { settings, codeSequence };
}
