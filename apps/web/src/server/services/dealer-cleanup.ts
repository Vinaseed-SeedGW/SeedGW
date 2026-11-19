import 'server-only';
import type { Prisma } from '@prisma/client';
import { auditChanges, type AuditChanges } from '@seedgw/contracts/audit';
import {
  classifyPhoneRaw,
  DUPLICATE_TABS,
  fillFromMerged,
  FILL_FIELD_LABEL,
  mergeBlockReason,
  phoneIssueKind,
  SHARED_PHONE_MIN,
  type BadPhonesResult,
  type ClearDealerPhonesInput,
  type DismissDuplicateInput,
  type DuplicateKind,
  type DuplicateTab,
  type FillableDealer,
  type FixDealerPhoneInput,
  type ListBadPhonesInput,
  type ListDuplicatesInput,
  type ListDuplicatesResult,
  type MergeDealersInput,
  type PhoneIssueKind,
} from '@seedgw/contracts/dealer-cleanup';
import { normalizeSearchText } from '@seedgw/contracts/text';
import { db } from '@seedgw/db/client';
import type { ScopedDb } from '@seedgw/db/scoped-client';
import { DomainError } from './domain-error';

export type DealerAuditOutcome = { id: string; label: string; changes: AuditChanges };

const labelOf = (dealer: { code: string | null; legacyCode: string | null; name: string }) =>
  dealer.code ?? dealer.legacyCode ?? dealer.name;

// ---------- Số điện thoại sai dạng ----------

async function loadBadPhones(scoped: ScopedDb) {
  const rows = await scoped.dealer.findMany({
    where: { phone: null, phoneRaw: { not: null } },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      name: true,
      code: true,
      legacyCode: true,
      address: true,
      phoneRaw: true,
      orgUnit: { select: { name: true } },
      assignedUser: { select: { fullName: true } },
    },
  });
  return rows.map((row) => ({ ...row, kind: classifyPhoneRaw(row.phoneRaw ?? '') }));
}

/** Đại lý có số gốc không đúng dạng 10 số, trong phạm vi người xem; khoảng vài nghìn dòng nên lọc trong bộ nhớ. */
export async function listBadPhones(
  scoped: ScopedDb,
  input: ListBadPhonesInput,
): Promise<BadPhonesResult> {
  const all = await loadBadPhones(scoped);
  const counts = Object.fromEntries(phoneIssueKind.options.map((kind) => [kind, 0])) as Record<
    PhoneIssueKind,
    number
  >;
  for (const row of all) counts[row.kind] += 1;
  const q = input.q ? normalizeSearchText(input.q) : '';
  const filtered = all.filter(
    (row) =>
      (!input.kind || row.kind === input.kind) &&
      (!q ||
        normalizeSearchText(
          `${row.name} ${row.code ?? ''} ${row.legacyCode ?? ''} ${row.phoneRaw ?? ''}`,
        ).includes(q)),
  );
  const start = (input.page - 1) * input.pageSize;
  return {
    items: filtered.slice(start, start + input.pageSize).map((row) => ({
      id: row.id,
      name: row.name,
      code: row.code ?? row.legacyCode,
      address: row.address,
      phoneRaw: row.phoneRaw ?? '',
      kind: row.kind,
      orgUnitName: row.orgUnit?.name ?? null,
      assignedUserName: row.assignedUser?.fullName ?? null,
    })),
    total: filtered.length,
    page: input.page,
    pageSize: input.pageSize,
    counts,
  };
}

export async function fixDealerPhone(
  scoped: ScopedDb,
  input: FixDealerPhoneInput,
): Promise<DealerAuditOutcome> {
  const dealer = await scoped.dealer.findUnique({
    where: { id: input.id },
    select: { id: true, name: true, code: true, legacyCode: true, phone: true, phoneRaw: true },
  });
  if (!dealer)
    throw new DomainError('NOT_FOUND', 'Không tìm thấy đại lý hoặc ngoài phạm vi của bạn');
  await scoped.dealer.update({
    where: { id: input.id },
    data: { phone: input.phone, phoneRaw: null },
  });
  return {
    id: dealer.id,
    label: labelOf(dealer),
    changes: auditChanges({ phone: dealer.phone ?? dealer.phoneRaw }, { phone: input.phone }),
  };
}

/** Bỏ số sai, để trống điện thoại chờ người phụ trách cập nhật số thật. */
export async function clearDealerPhones(
  scoped: ScopedDb,
  input: ClearDealerPhonesInput,
): Promise<DealerAuditOutcome[]> {
  const targets =
    'ids' in input
      ? await scoped.dealer.findMany({
          where: { id: { in: input.ids }, phone: null, phoneRaw: { not: null } },
          select: { id: true, name: true, code: true, legacyCode: true, phoneRaw: true },
        })
      : (await loadBadPhones(scoped)).filter((row) => row.kind === 'JUNK');
  if (targets.length === 0) return [];
  await scoped.dealer.updateMany({
    where: { id: { in: targets.map((row) => row.id) }, phone: null },
    data: { phoneRaw: null },
  });
  return targets.map((row) => ({
    id: row.id,
    label: labelOf(row),
    changes: auditChanges({ phone: row.phoneRaw }, { phone: null }),
  }));
}

// ---------- Đại lý trùng ----------

const MEMBER_SELECT = {
  id: true,
  code: true,
  legacyCode: true,
  name: true,
  level: true,
  address: true,
  provinceName: true,
  phone: true,
  taxCode: true,
  ownerName: true,
  lat: true,
  lng: true,
  assignedUser: { select: { fullName: true } },
  orgUnit: { select: { name: true } },
  _count: { select: { checkIns: true } },
} satisfies Prisma.DealerSelect;

function kindOfTab(tab: DuplicateTab): DuplicateKind {
  return tab === 'ma-so-thue' ? 'TAX' : 'PHONE';
}

async function groupValues(scoped: ScopedDb, kind: DuplicateKind) {
  const dismissed = await db.dealerDuplicateDismissal.findMany({
    where: { kind },
    select: { value: true },
  });
  const skip = dismissed.map((row) => row.value);
  const rows =
    kind === 'PHONE'
      ? await scoped.dealer.findMany({
          where: { status: 'ACTIVE', phone: { not: null, notIn: skip } },
          select: { phone: true, name: true },
        })
      : await scoped.dealer.findMany({
          where: {
            status: 'ACTIVE',
            AND: [
              { taxCode: { not: null } },
              { taxCode: { not: '' } },
              { taxCode: { notIn: skip } },
            ],
          },
          select: { taxCode: true, name: true },
        });
  const groups = new Map<string, string[]>();
  for (const row of rows) {
    const value = 'phone' in row ? row.phone : row.taxCode;
    if (!value) continue;
    const names = groups.get(value) ?? [];
    names.push(normalizeSearchText(row.name));
    groups.set(value, names);
  }
  return [...groups.entries()]
    .filter(([, names]) => names.length > 1)
    .map(([value, names]) => ({ value, size: names.length, sameName: new Set(names).size === 1 }));
}

/** Nhóm cùng số điện thoại hoặc mã số thuế trong phạm vi. Nhóm trùng cả tên xếp lên đầu. */
export async function listDuplicates(
  scoped: ScopedDb,
  input: ListDuplicatesInput,
): Promise<ListDuplicatesResult> {
  const [phones, taxes] = await Promise.all([
    groupValues(scoped, 'PHONE'),
    groupValues(scoped, 'TAX'),
  ]);
  const byTab: Record<DuplicateTab, typeof phones> = {
    'nghi-trung': phones.filter((group) => group.size < SHARED_PHONE_MIN),
    'so-dung-chung': phones.filter((group) => group.size >= SHARED_PHONE_MIN),
    'ma-so-thue': taxes,
  };
  const q = input.q?.replace(/\s/g, '');
  const groups = byTab[input.tab]
    .filter((group) => !q || group.value.includes(q))
    .sort(
      (a, b) =>
        Number(b.sameName) - Number(a.sameName) ||
        (input.tab === 'so-dung-chung' ? b.size - a.size : a.size - b.size) ||
        a.value.localeCompare(b.value),
    );
  const start = (input.page - 1) * input.pageSize;
  const page = groups.slice(start, start + input.pageSize);
  const kind = kindOfTab(input.tab);
  const values = page.map((group) => group.value);
  const members = values.length
    ? await scoped.dealer.findMany({
        where: {
          status: 'ACTIVE',
          ...(kind === 'PHONE' ? { phone: { in: values } } : { taxCode: { in: values } }),
        },
        orderBy: [{ code: 'asc' }, { name: 'asc' }],
        select: MEMBER_SELECT,
      })
    : [];
  return {
    items: page.map((group) => ({
      kind,
      value: group.value,
      sameName: group.sameName,
      members: members
        .filter((member) => (kind === 'PHONE' ? member.phone : member.taxCode) === group.value)
        .map((member) => ({
          id: member.id,
          code: member.code,
          legacyCode: member.legacyCode,
          name: member.name,
          level: member.level,
          address: member.address,
          provinceName: member.provinceName,
          phone: member.phone,
          taxCode: member.taxCode,
          ownerName: member.ownerName,
          assignedUserName: member.assignedUser?.fullName ?? null,
          orgUnitName: member.orgUnit?.name ?? null,
          checkInCount: member._count.checkIns,
          hasLocation: member.lat !== null && member.lng !== null,
        })),
    })),
    total: groups.length,
    page: input.page,
    pageSize: input.pageSize,
    counts: Object.fromEntries(DUPLICATE_TABS.map((tab) => [tab, byTab[tab].length])) as Record<
      DuplicateTab,
      number
    >,
  };
}

const MERGE_SELECT = {
  id: true,
  code: true,
  legacyCode: true,
  name: true,
  phone: true,
  ownerName: true,
  ownerPhone: true,
  taxCode: true,
  provinceName: true,
  lat: true,
  lng: true,
  lastVisitedAt: true,
} satisfies Prisma.DealerSelect;

/**
 * Gộp đại lý trùng (A7b): check-in, điểm trong tuyến, đề xuất toạ độ và đại lý con chuyển sang bản giữ lại;
 * ô trống của bản giữ lại lấy từ bản gộp; bản gộp chuyển Ngừng hoạt động, ghi đã gộp vào đâu, không xoá.
 * Mọi đại lý phải nằm trong phạm vi của người gộp.
 */
export async function mergeDealers(
  scoped: ScopedDb,
  actorId: string,
  input: MergeDealersInput,
): Promise<DealerAuditOutcome[]> {
  const ids = [input.keptId, ...new Set(input.mergedIds)];
  const found = await scoped.dealer.findMany({
    where: { id: { in: ids }, status: 'ACTIVE' },
    select: MERGE_SELECT,
  });
  const kept = found.find((dealer) => dealer.id === input.keptId);
  const merged = found.filter((dealer) => dealer.id !== input.keptId);
  if (!kept || merged.length !== ids.length - 1) {
    throw new DomainError(
      'NOT_FOUND',
      'Có đại lý đã gộp, ngừng hoạt động hoặc ngoài phạm vi của bạn, tải lại trang',
    );
  }
  const blocked = mergeBlockReason(kept, merged);
  if (blocked) throw new DomainError('CONFLICT', blocked);

  const fill = fillFromMerged(kept as FillableDealer, merged as FillableDealer[]);
  const filledLabels = [
    ...new Set((Object.keys(fill) as (keyof FillableDealer)[]).map((key) => FILL_FIELD_LABEL[key])),
  ];
  const lastVisits = [kept, ...merged]
    .map((dealer) => dealer.lastVisitedAt?.getTime() ?? 0)
    .filter((time) => time > 0);

  return db.$transaction(async (tx) => {
    const keptPending = await tx.dealerLocationProposal.count({
      where: { dealerId: kept.id, status: 'PENDING' },
    });
    const outcomes: DealerAuditOutcome[] = [];
    for (const dealer of merged) {
      const checkIns = await tx.checkIn.updateMany({
        where: { dealerId: dealer.id },
        data: { dealerId: kept.id },
      });
      const stops = await tx.routePlanStop.updateMany({
        where: { dealerId: dealer.id },
        data: { dealerId: kept.id },
      });
      // Mỗi đại lý chỉ có một đề xuất toạ độ đang chờ: bản giữ lại đã có thì bỏ đề xuất chờ của bản gộp.
      if (keptPending > 0) {
        await tx.dealerLocationProposal.deleteMany({
          where: { dealerId: dealer.id, status: 'PENDING' },
        });
      }
      const proposals = await tx.dealerLocationProposal.updateMany({
        where: { dealerId: dealer.id },
        data: { dealerId: kept.id },
      });
      const children = await tx.dealer.updateMany({
        where: { parentId: dealer.id },
        data: { parentId: kept.id },
      });
      await tx.dealer.update({
        where: { id: dealer.id },
        data: { status: 'INACTIVE', mergedIntoId: kept.id },
      });
      await tx.dealerMerge.create({
        data: {
          keptId: kept.id,
          mergedId: dealer.id,
          actorId,
          movedCheckIns: checkIns.count,
          movedStops: stops.count,
          movedProposals: proposals.count,
          movedChildren: children.count,
          filledFields: filledLabels,
        },
      });
      outcomes.push({
        id: dealer.id,
        label: labelOf(dealer),
        changes: auditChanges(
          { status: 'Đang hoạt động', mergedInto: null, movedData: null },
          {
            status: 'Ngừng hoạt động',
            mergedInto: `${labelOf(kept)} ${kept.name}`,
            movedData: `${checkIns.count} check-in, ${stops.count} điểm tuyến, ${proposals.count} đề xuất toạ độ, ${children.count} đại lý con`,
          },
        ),
      });
    }

    await tx.dealer.update({
      where: { id: kept.id },
      data: {
        ...fill,
        ...(fill.lat !== undefined ? { locatedAt: new Date() } : {}),
        ...(lastVisits.length ? { lastVisitedAt: new Date(Math.max(...lastVisits)) } : {}),
      },
    });
    const keptChanges: Record<
      string,
      { before: string | number | null; after: string | number | null }
    > = {};
    for (const [key, value] of Object.entries(fill)) {
      if (key === 'lng') continue;
      const label = key === 'lat' ? 'location' : key;
      keptChanges[label] = {
        before: null,
        after: key === 'lat' ? `${fill.lat}, ${fill.lng}` : (value as string),
      };
    }
    outcomes.push({
      id: kept.id,
      label: labelOf(kept),
      changes: {
        ...keptChanges,
        'Gộp từ': { before: null, after: merged.map((dealer) => labelOf(dealer)).join(', ') },
      },
    });
    return outcomes;
  });
}

/** Nhóm đã xem và không phải trùng (số dùng chung, hai cửa hàng khác nhau cùng chủ ...). */
export async function dismissDuplicate(
  scoped: ScopedDb,
  actorId: string,
  input: DismissDuplicateInput,
): Promise<void> {
  const count = await scoped.dealer.count({
    where: {
      status: 'ACTIVE',
      ...(input.kind === 'PHONE' ? { phone: input.value } : { taxCode: input.value }),
    },
  });
  if (count < 2) throw new DomainError('NOT_FOUND', 'Nhóm này không còn trong phạm vi của bạn');
  await db.dealerDuplicateDismissal.upsert({
    where: { kind_value: { kind: input.kind, value: input.value } },
    update: {},
    create: { kind: input.kind, value: input.value, dismissedById: actorId },
  });
}

/** Số giả dùng chung (0123456789 ...): bỏ số khỏi mọi đại lý trong phạm vi đang dùng số đó. */
export async function clearSharedPhone(
  scoped: ScopedDb,
  phone: string,
): Promise<DealerAuditOutcome[]> {
  const dealers = await scoped.dealer.findMany({
    where: { phone },
    select: { id: true, name: true, code: true, legacyCode: true },
  });
  if (dealers.length === 0) return [];
  await scoped.dealer.updateMany({ where: { phone }, data: { phone: null } });
  return dealers.map((dealer) => ({
    id: dealer.id,
    label: labelOf(dealer),
    changes: auditChanges({ phone }, { phone: null }),
  }));
}
