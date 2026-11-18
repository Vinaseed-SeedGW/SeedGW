'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import type { AuditAction } from '@dms/contracts/audit';
import type { ActionResult } from '@dms/contracts/common';
import {
  clearDealerPhonesInput,
  clearSharedPhoneInput,
  dismissDuplicateInput,
  fixDealerPhoneInput,
  mergeDealersInput,
} from '@dms/contracts/dealer-cleanup';
import { toActionError, validationError } from '@/server/auth/action-error';
import { assertCan } from '@/server/auth/can';
import { requireUser, type CurrentUser } from '@/server/auth/current-user';
import { getScopedDb } from '@/server/auth/scoped-db';
import { getClientIp, writeAuditMany } from '@/server/services/audit';
import {
  clearDealerPhones,
  clearSharedPhone,
  dismissDuplicate,
  fixDealerPhone,
  mergeDealers,
  type DealerAuditOutcome,
} from '@/server/services/dealer-cleanup';

async function start(): Promise<CurrentUser> {
  const user = await requireUser();
  assertCan(user, 'admin.dealer.cleanup');
  return user;
}

async function audit(
  user: CurrentUser,
  action: AuditAction,
  outcomes: readonly DealerAuditOutcome[],
) {
  const ip = await getClientIp();
  after(() =>
    writeAuditMany(
      outcomes.map((outcome) => ({
        actor: user,
        action,
        entityType: 'Dealer' as const,
        entityId: outcome.id,
        entityLabel: outcome.label,
        changes: outcome.changes,
        ip,
      })),
    ),
  );
  revalidatePath('/quan-tri/dai-ly', 'layout');
  revalidatePath('/kinh-doanh/dai-ly', 'layout');
}

export async function fixDealerPhoneAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await start();
    const parsed = fixDealerPhoneInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);
    const outcome = await fixDealerPhone(await getScopedDb(), parsed.data);
    await audit(user, 'dealer.phone-fix', [outcome]);
    return { ok: true, data: { id: outcome.id } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function clearDealerPhonesAction(
  raw: unknown,
): Promise<ActionResult<{ cleared: number }>> {
  try {
    const user = await start();
    const parsed = clearDealerPhonesInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);
    const outcomes = await clearDealerPhones(await getScopedDb(), parsed.data);
    await audit(user, 'dealer.phone-fix', outcomes);
    return { ok: true, data: { cleared: outcomes.length } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function mergeDealersAction(raw: unknown): Promise<ActionResult<{ merged: number }>> {
  try {
    const user = await start();
    const parsed = mergeDealersInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);
    const outcomes = await mergeDealers(await getScopedDb(), user.id, parsed.data);
    await audit(user, 'dealer.merge', outcomes);
    return { ok: true, data: { merged: outcomes.length - 1 } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function dismissDuplicateAction(raw: unknown): Promise<ActionResult<null>> {
  try {
    const user = await start();
    const parsed = dismissDuplicateInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);
    await dismissDuplicate(await getScopedDb(), user.id, parsed.data);
    const ip = await getClientIp();
    after(() =>
      writeAuditMany([
        {
          actor: user,
          action: 'dealer.duplicate-dismiss',
          entityType: 'Dealer',
          entityId: user.id,
          entityLabel: parsed.data.value,
          changes: {
            [parsed.data.kind === 'PHONE' ? 'phone' : 'taxCode']: {
              before: null,
              after: `${parsed.data.value}, không phải đại lý trùng`,
            },
          },
          ip,
        },
      ]),
    );
    revalidatePath('/quan-tri/dai-ly/trung');
    return { ok: true, data: null };
  } catch (error) {
    return toActionError(error);
  }
}

export async function clearSharedPhoneAction(
  raw: unknown,
): Promise<ActionResult<{ cleared: number }>> {
  try {
    const user = await start();
    const parsed = clearSharedPhoneInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);
    const outcomes = await clearSharedPhone(await getScopedDb(), parsed.data.phone);
    await audit(user, 'dealer.phone-fix', outcomes);
    return { ok: true, data: { cleared: outcomes.length } };
  } catch (error) {
    return toActionError(error);
  }
}
