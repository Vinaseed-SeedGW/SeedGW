'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import type { ActionResult } from '@seedgw/contracts/common';
import { reviewDealerLocationInput } from '@seedgw/contracts/dealer-locations';
import { toActionError, validationError } from '@/server/auth/action-error';
import { assertCan } from '@/server/auth/can';
import { requireUser } from '@/server/auth/current-user';
import { getClientIp, writeAudit } from '@/server/services/audit';
import { reviewProposal } from '@/server/services/dealer-locations';

export async function reviewDealerLocationAction(
  raw: unknown,
): Promise<ActionResult<{ dealerId: string }>> {
  try {
    const user = await requireUser();
    assertCan(user, 'admin.dealer-location.approve');
    const parsed = reviewDealerLocationInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);

    const [outcome, ip] = await Promise.all([reviewProposal(user.id, parsed.data), getClientIp()]);
    after(() =>
      writeAudit({
        actor: user,
        action: outcome.approved ? 'dealer.location.approve' : 'dealer.location.reject',
        entityType: 'Dealer',
        entityId: outcome.dealerId,
        entityLabel: outcome.dealerName,
        changes: outcome.changes,
        ip,
      }),
    );
    revalidatePath('/quan-tri/dai-ly', 'layout');
    revalidatePath('/kinh-doanh/dai-ly', 'layout');
    return { ok: true, data: { dealerId: outcome.dealerId } };
  } catch (error) {
    return toActionError(error);
  }
}
