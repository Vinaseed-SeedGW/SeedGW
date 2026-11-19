import 'server-only';
import type {
  BadPhonesResult,
  ListBadPhonesInput,
  ListDuplicatesInput,
  ListDuplicatesResult,
} from '@seedgw/contracts/dealer-cleanup';
import { assertCan } from '@/server/auth/can';
import { requireUser } from '@/server/auth/current-user';
import { getScopedDb } from '@/server/auth/scoped-db';
import { listBadPhones, listDuplicates } from '@/server/services/dealer-cleanup';

export async function getBadPhones(input: ListBadPhonesInput): Promise<BadPhonesResult> {
  const user = await requireUser();
  assertCan(user, 'admin.dealer.cleanup');
  return listBadPhones(await getScopedDb(), input);
}

export async function getDuplicateGroups(
  input: ListDuplicatesInput,
): Promise<ListDuplicatesResult> {
  const user = await requireUser();
  assertCan(user, 'admin.dealer.cleanup');
  return listDuplicates(await getScopedDb(), input);
}
