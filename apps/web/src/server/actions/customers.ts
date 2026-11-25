'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { z } from 'zod';
import type { ActionResult } from '@seedgw/contracts/common';
import { createCustomerInput, updateCustomerInput } from '@seedgw/contracts/customers';
import { escapeLikePattern, normalizeSearchText } from '@seedgw/contracts/text';
import { toActionError, validationError } from '@/server/auth/action-error';
import { assertCan, can, ForbiddenError } from '@/server/auth/can';
import { requireUser } from '@/server/auth/current-user';
import { getScopedDb } from '@/server/auth/scoped-db';
import { getClientIp, writeAudit } from '@/server/services/audit';
import { createCustomer, updateCustomer } from '@/server/services/customers';

function revalidateCustomers() {
  revalidatePath('/kinh-doanh/khach-hang', 'layout');
}

export async function createCustomerAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    assertCan(user, 'sales.customer.create');
    const parsed = createCustomerInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);

    const [outcome, ip] = await Promise.all([createCustomer(user, parsed.data), getClientIp()]);
    after(() =>
      writeAudit({
        actor: user,
        action: 'customer.create',
        entityType: 'Customer',
        entityId: outcome.id,
        entityLabel: outcome.label,
        changes: outcome.changes,
        ip,
      }),
    );
    revalidateCustomers();
    return { ok: true, data: { id: outcome.id } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateCustomerAction(raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await requireUser();
    assertCan(user, 'sales.customer.update');
    const parsed = updateCustomerInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);

    const [outcome, ip] = await Promise.all([updateCustomer(user, parsed.data), getClientIp()]);
    if (Object.keys(outcome.changes).length > 0) {
      after(() =>
        writeAudit({
          actor: user,
          action: 'customer.update',
          entityType: 'Customer',
          entityId: outcome.id,
          entityLabel: outcome.label,
          changes: outcome.changes,
          ip,
        }),
      );
    }
    revalidateCustomers();
    return { ok: true, data: { id: outcome.id } };
  } catch (error) {
    return toActionError(error);
  }
}

const searchDealersInput = z.string().trim().max(100);

export type DealerChoice = { value: string; label: string };

/** Tìm đại lý trong phạm vi để chọn Đại lý hay mua trên form khách hàng. */
export async function searchCustomerDealersAction(
  raw: unknown,
): Promise<ActionResult<DealerChoice[]>> {
  try {
    const user = await requireUser();
    if (!can(user, 'sales.customer.create') && !can(user, 'sales.customer.update')) {
      throw new ForbiddenError('sales.customer.update');
    }
    const parsed = searchDealersInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);
    const search = normalizeSearchText(parsed.data);
    if (search.length < 2) return { ok: true, data: [] };
    const scoped = await getScopedDb();
    const rows = await scoped.dealer.findMany({
      where: { status: 'ACTIVE', searchText: { contains: escapeLikePattern(search) } },
      orderBy: { name: 'asc' },
      take: 20,
      select: { id: true, name: true, code: true, legacyCode: true, provinceName: true },
    });
    return {
      ok: true,
      data: rows.map((row) => ({
        value: row.id,
        label: [row.name, row.code ?? row.legacyCode, row.provinceName].filter(Boolean).join(', '),
      })),
    };
  } catch (error) {
    return toActionError(error);
  }
}
