import 'server-only';
import type { MobileCustomerOption } from '@seedgw/contracts/customers';
import { escapeLikePattern, normalizeSearchText } from '@seedgw/contracts/text';
import { distanceMeters } from '@seedgw/contracts/track-distance';
import { db } from '@seedgw/db/client';
import { mobileScopedDb, type MobileUser } from '@/server/auth/mobile';

const RESULT_LIMIT = 30;
const NEARBY_DEGREES = 0.2;

const OPTION_SELECT = {
  id: true,
  code: true,
  kind: true,
  name: true,
  phone: true,
  address: true,
  lat: true,
  lng: true,
} as const;

/** S1: khách hàng để chọn khi check-in, trong phạm vi của nhân viên, gần nhất lên đầu. */
export async function listMobileCustomers(
  user: MobileUser,
  query: { q?: string; lat?: number; lng?: number },
): Promise<MobileCustomerOption[]> {
  const scoped = await mobileScopedDb(user);
  const search = query.q ? normalizeSearchText(query.q) : '';
  const base = search ? { searchText: { contains: escapeLikePattern(search) } } : {};
  const here =
    query.lat !== undefined && query.lng !== undefined ? { lat: query.lat, lng: query.lng } : null;

  const nearby = here
    ? await scoped.customer.findMany({
        where: {
          ...base,
          lat: { gte: here.lat - NEARBY_DEGREES, lte: here.lat + NEARBY_DEGREES },
          lng: { gte: here.lng - NEARBY_DEGREES, lte: here.lng + NEARBY_DEGREES },
        },
        take: 200,
        select: OPTION_SELECT,
      })
    : [];
  const sortedNearby = nearby
    .map((customer) => ({
      customer,
      distanceM:
        here && customer.lat !== null && customer.lng !== null
          ? Math.round(distanceMeters(here, { lat: customer.lat, lng: customer.lng }))
          : null,
    }))
    .sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity))
    .slice(0, RESULT_LIMIT);

  const rest =
    sortedNearby.length < RESULT_LIMIT
      ? await scoped.customer.findMany({
          where: { ...base, id: { notIn: sortedNearby.map((item) => item.customer.id) } },
          orderBy: [{ lastVisitedAt: { sort: 'desc', nulls: 'last' } }, { name: 'asc' }],
          take: RESULT_LIMIT - sortedNearby.length,
          select: OPTION_SELECT,
        })
      : [];

  return [...sortedNearby, ...rest.map((customer) => ({ customer, distanceM: null }))].map(
    ({ customer, distanceM }) => ({
      id: customer.id,
      code: customer.code,
      kind: customer.kind,
      name: customer.name,
      phone: customer.phone,
      address: customer.address,
      distanceM,
    }),
  );
}

/** Khách hàng của lượt check-in, chỉ trong phạm vi; sai phạm vi thì bỏ, không chặn check-in. */
export async function resolveCheckInCustomer(
  user: MobileUser,
  input: { customerId: string | null; placeKind: string },
): Promise<{ id: string; lat: number | null } | null> {
  if (input.placeKind !== 'CUSTOMER' || !input.customerId) return null;
  const scoped = await mobileScopedDb(user);
  return scoped.customer.findUnique({
    where: { id: input.customerId },
    select: { id: true, lat: true },
  });
}

/** Ghi lần ghé gần nhất; khách hàng chưa có toạ độ thì lấy vị trí lượt check-in đầu tiên. */
export async function markCustomerVisited(
  customer: { id: string; lat: number | null },
  visit: { capturedAt: Date; lat: number; lng: number },
): Promise<void> {
  await db.customer.updateMany({
    where: {
      id: customer.id,
      OR: [{ lastVisitedAt: null }, { lastVisitedAt: { lt: visit.capturedAt } }],
    },
    data: { lastVisitedAt: visit.capturedAt },
  });
  if (customer.lat === null) {
    await db.customer.updateMany({
      where: { id: customer.id, lat: null },
      data: { lat: visit.lat, lng: visit.lng },
    });
  }
}
