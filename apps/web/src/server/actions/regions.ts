'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import type { ActionResult } from '@seedgw/contracts/common';
import { setProvinceRegionInput } from '@seedgw/contracts/regions';
import { toActionError, validationError } from '@/server/auth/action-error';
import { assertCan } from '@/server/auth/can';
import { requireUser } from '@/server/auth/current-user';
import { getClientIp, writeAudit } from '@/server/services/audit';
import { setProvinceRegion } from '@/server/services/regions';

export async function setProvinceRegionAction(raw: unknown): Promise<ActionResult<null>> {
  try {
    const user = await requireUser();
    assertCan(user, 'admin.region.manage');
    const parsed = setProvinceRegionInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);
    const [outcome, ip] = await Promise.all([setProvinceRegion(parsed.data), getClientIp()]);
    if (Object.keys(outcome.changes).length > 0) {
      after(() =>
        writeAudit({
          actor: user,
          action: 'province.region',
          entityType: 'Province',
          entityId: parsed.data.provinceName,
          entityLabel: parsed.data.provinceName,
          changes: outcome.changes,
          ip,
        }),
      );
    }
    revalidatePath('/quan-tri/vung-tinh');
    return { ok: true, data: null };
  } catch (error) {
    return toActionError(error);
  }
}
