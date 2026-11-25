'use server';

import type { ActionResult } from '@seedgw/contracts/common';
import {
  globalSearchInput,
  SEARCH_LIMIT_PER_GROUP,
  SEARCH_MIN_LENGTH,
  type SearchHit,
} from '@seedgw/contracts/search';
import { escapeLikePattern, normalizeSearchText } from '@seedgw/contracts/text';
import { toActionError, validationError } from '@/server/auth/action-error';
import { can } from '@/server/auth/can';
import { requireUser } from '@/server/auth/current-user';
import { getScopedDb } from '@/server/auth/scoped-db';

const SUPPORT_CODE = /^HT-\d{4}-\d{1,5}$/i;

/** D3: tìm đại lý, khách hàng, tài khoản, mã yêu cầu hỗ trợ trong phạm vi của người tìm. */
export async function globalSearchAction(raw: unknown): Promise<ActionResult<SearchHit[]>> {
  try {
    const user = await requireUser();
    const parsed = globalSearchInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);
    const search = normalizeSearchText(parsed.data);
    if (search.length < SEARCH_MIN_LENGTH) return { ok: true, data: [] };
    const contains = { contains: escapeLikePattern(search) };
    const scoped = await getScopedDb();

    const dealerBase = can(user, 'sales.dealer.read')
      ? '/kinh-doanh/dai-ly'
      : can(user, 'admin.dealer.read')
        ? '/quan-tri/dai-ly'
        : null;
    const supportCode = SUPPORT_CODE.test(parsed.data) ? parsed.data.toUpperCase() : null;

    const [dealers, customers, users, supports] = await Promise.all([
      dealerBase
        ? scoped.dealer.findMany({
            where: { searchText: contains },
            orderBy: [{ status: 'asc' }, { name: 'asc' }],
            take: SEARCH_LIMIT_PER_GROUP,
            select: { id: true, name: true, code: true, legacyCode: true, provinceName: true },
          })
        : [],
      can(user, 'sales.customer.read')
        ? scoped.customer.findMany({
            where: { searchText: contains },
            orderBy: { name: 'asc' },
            take: SEARCH_LIMIT_PER_GROUP,
            select: { id: true, name: true, code: true, provinceName: true },
          })
        : [],
      can(user, 'admin.user.read')
        ? scoped.user.findMany({
            where: { searchText: contains },
            orderBy: { employeeCode: 'asc' },
            take: SEARCH_LIMIT_PER_GROUP,
            select: {
              id: true,
              employeeCode: true,
              fullName: true,
              orgUnit: { select: { name: true } },
            },
          })
        : [],
      supportCode && can(user, 'support.request.manage')
        ? scoped.supportRequest.findMany({
            where: { code: supportCode },
            take: 1,
            select: { id: true, code: true, title: true },
          })
        : [],
    ]);

    const hits: SearchHit[] = [
      ...dealers.map((row) => ({
        group: 'dealer' as const,
        id: row.id,
        title: row.name,
        detail: [row.code ?? row.legacyCode, row.provinceName].filter(Boolean).join(', '),
        href: `${dealerBase}/${row.id}`,
      })),
      ...customers.map((row) => ({
        group: 'customer' as const,
        id: row.id,
        title: row.name,
        detail: [row.code, row.provinceName].filter(Boolean).join(', '),
        href: `/kinh-doanh/khach-hang/${row.id}`,
      })),
      ...users.map((row) => ({
        group: 'user' as const,
        id: row.id,
        title: row.fullName,
        detail: [row.employeeCode, row.orgUnit?.name].filter(Boolean).join(', '),
        href: `/quan-tri/tai-khoan/${row.id}`,
      })),
      ...supports.map((row) => ({
        group: 'support' as const,
        id: row.id,
        title: row.code,
        detail: row.title,
        href: `/quan-tri/ho-tro/${row.code}`,
      })),
    ];
    return { ok: true, data: hits };
  } catch (error) {
    return toActionError(error);
  }
}
