import 'server-only';
import type { MobileDealerOption, DealerLevel } from '@seedgw/contracts/dealers';
import { escapeLikePattern, normalizeSearchText } from '@seedgw/contracts/text';
import { distanceMeters } from '@seedgw/contracts/track-distance';
import { mobileScopedDb, type MobileUser } from '@/server/auth/mobile';

const RESULT_LIMIT = 30;
// Tìm đại lý gần trong ô khoảng 20 km quanh vị trí, rồi xếp theo khoảng cách thật.
const NEARBY_DEGREES = 0.2;

const OPTION_SELECT = {
  id: true,
  code: true,
  legacyCode: true,
  name: true,
  address: true,
  level: true,
  lat: true,
  lng: true,
} as const;

/**
 * Đại lý để chọn khi check-in, chỉ trong phạm vi của nhân viên. Có vị trí thì đại lý gần nhất lên đầu
 * (đại lý đã có toạ độ), sau đó tới các đại lý còn lại theo tên.
 */
export async function listMobileDealers(
  user: MobileUser,
  query: { q?: string; lat?: number; lng?: number },
): Promise<MobileDealerOption[]> {
  const scoped = await mobileScopedDb(user);
  const search = query.q ? normalizeSearchText(query.q) : '';
  const base = {
    status: 'ACTIVE' as const,
    ...(search ? { searchText: { contains: escapeLikePattern(search) } } : {}),
  };
  const here =
    query.lat !== undefined && query.lng !== undefined ? { lat: query.lat, lng: query.lng } : null;

  const nearby = here
    ? await scoped.dealer.findMany({
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
    .map((dealer) => ({
      dealer,
      distanceM:
        here && dealer.lat !== null && dealer.lng !== null
          ? Math.round(distanceMeters(here, { lat: dealer.lat, lng: dealer.lng }))
          : null,
    }))
    .sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity))
    .slice(0, RESULT_LIMIT);

  const rest =
    sortedNearby.length < RESULT_LIMIT
      ? await scoped.dealer.findMany({
          where: { ...base, id: { notIn: sortedNearby.map((item) => item.dealer.id) } },
          orderBy: { name: 'asc' },
          take: RESULT_LIMIT - sortedNearby.length,
          select: OPTION_SELECT,
        })
      : [];

  return [...sortedNearby, ...rest.map((dealer) => ({ dealer, distanceM: null }))].map(
    ({ dealer, distanceM }) => ({
      id: dealer.id,
      code: dealer.code,
      legacyCode: dealer.legacyCode,
      name: dealer.name,
      address: dealer.address,
      level: dealer.level as DealerLevel,
      lat: dealer.lat,
      lng: dealer.lng,
      distanceM,
    }),
  );
}

const CHECK_IN_DEALER_SELECT = {
  id: true,
  address: true,
  lat: true,
  lng: true,
  orgUnitId: true,
} as const;

export type CheckInDealer = {
  id: string;
  address: string;
  lat: number | null;
  lng: number | null;
  orgUnitId: string | null;
};

/**
 * Đại lý của lượt check-in, chỉ trong phạm vi của nhân viên; sai phạm vi thì bỏ, không chặn check-in.
 * Không chọn từ danh sách (mất mạng lúc tìm) mà gõ đúng tên một đại lý mình phụ trách thì tự gắn.
 */
export async function resolveCheckInDealer(
  user: MobileUser,
  input: { dealerId: string | null; placeKind: string; placeName: string },
): Promise<CheckInDealer | null> {
  if (input.placeKind !== 'DEALER') return null;
  const scoped = await mobileScopedDb(user);
  if (input.dealerId) {
    return scoped.dealer.findUnique({
      where: { id: input.dealerId },
      select: CHECK_IN_DEALER_SELECT,
    });
  }
  const name = normalizeSearchText(input.placeName);
  if (name.length < 3) return null;
  const candidates = await scoped.dealer.findMany({
    where: { status: 'ACTIVE', searchText: { contains: escapeLikePattern(name) } },
    take: 10,
    select: { ...CHECK_IN_DEALER_SELECT, name: true },
  });
  const exact = candidates.filter((dealer) => normalizeSearchText(dealer.name) === name);
  // Trùng tên nhiều đại lý thì không đoán, để quản lý xem tên gõ tay.
  const [only] = exact;
  if (exact.length !== 1 || !only) return null;
  return {
    id: only.id,
    address: only.address,
    lat: only.lat,
    lng: only.lng,
    orgUnitId: only.orgUnitId,
  };
}
