import 'server-only';
import type { Prisma } from '@prisma/client';
import { auditChanges, type AuditChanges } from '@seedgw/contracts/audit';
import { DEALER_LEVEL_LABEL, type DealerLevel } from '@seedgw/contracts/dealers';
import {
  DUPLICATE_RADIUS_M,
  MY_PROPOSALS_DAYS,
  type ApproveDealerProposalInput,
  type DealerProposalRow,
  type DuplicateCandidate,
  type DuplicateReason,
  type ListDealerProposalsInput,
  type ListDealerProposalsResult,
  type MarkDuplicateDealerProposalInput,
  type MyDealerProposalsResult,
  type RejectDealerProposalInput,
} from '@seedgw/contracts/dealer-proposals';
import { distanceMeters } from '@seedgw/contracts/track-distance';
import { db } from '@seedgw/db/client';
import type { MobileUser } from '@/server/auth/mobile';
import { getAssignableOrgUnitIds, getScopedDb } from '@/server/auth/scoped-db';
import { CHECK_IN_PHOTO_RETENTION_DAYS, presignGetUrl } from '@/server/integrations/object-storage';
import { DomainError } from './domain-error';
import { notifyDealerProposalReview } from './push-events';

// Đề xuất đại lý mới (M10). Quản trị đơn vị thấy đề xuất của nhân viên thuộc đơn vị mình và đơn vị con.

const PROPOSAL_SELECT = {
  id: true,
  name: true,
  phone: true,
  address: true,
  ownerName: true,
  taxCode: true,
  level: true,
  status: true,
  reviewedAt: true,
  reviewNote: true,
  orgUnitId: true,
  orgUnit: { select: { name: true } },
  proposedById: true,
  proposedBy: { select: { fullName: true, employeeCode: true } },
  reviewedBy: { select: { fullName: true } },
  dealer: { select: { id: true, name: true } },
  checkIn: {
    select: {
      capturedAt: true,
      address: true,
      addressOnPhoto: true,
      photoKey: true,
      lat: true,
      lng: true,
      accuracyM: true,
    },
  },
} satisfies Prisma.DealerProposalSelect;

type ProposalRecord = Prisma.DealerProposalGetPayload<{ select: typeof PROPOSAL_SELECT }>;

const PHOTO_RETENTION_MS = CHECK_IN_PHOTO_RETENTION_DAYS * 86_400_000;
const MAX_DUPLICATES = 5;
const METERS_PER_DEGREE = 111_320;

function toLevel(value: number): DealerLevel {
  return value === 1 || value === 2 ? value : 3;
}

function toRow(
  record: ProposalRecord,
  duplicates: DuplicateCandidate[],
  now: number,
): DealerProposalRow {
  const photoAlive =
    record.checkIn.photoKey && now - record.checkIn.capturedAt.getTime() < PHOTO_RETENTION_MS;
  return {
    id: record.id,
    name: record.name,
    phone: record.phone,
    address: record.address,
    ownerName: record.ownerName,
    taxCode: record.taxCode,
    level: toLevel(record.level),
    orgUnitId: record.orgUnitId,
    orgUnitName: record.orgUnit?.name ?? null,
    proposedById: record.proposedById,
    proposedByName: record.proposedBy.fullName,
    proposedByCode: record.proposedBy.employeeCode,
    capturedAt: record.checkIn.capturedAt.toISOString(),
    checkInAddress: record.checkIn.address ?? record.checkIn.addressOnPhoto,
    lat: record.checkIn.lat,
    lng: record.checkIn.lng,
    accuracyM: record.checkIn.accuracyM,
    photoUrl: photoAlive && record.checkIn.photoKey ? presignGetUrl(record.checkIn.photoKey) : null,
    status: record.status,
    reviewedByName: record.reviewedBy?.fullName ?? null,
    reviewedAt: record.reviewedAt?.toISOString() ?? null,
    reviewNote: record.reviewNote,
    dealer: record.dealer,
    duplicates,
  };
}

/**
 * Đại lý có sẵn có thể trùng: cùng số điện thoại (của đại lý hoặc chủ đại lý), cùng mã số thuế, hoặc nằm
 * trong bán kính quanh điểm chụp. Tìm trên toàn danh mục vì đại lý trùng có thể thuộc đơn vị khác.
 * Chỉ để người duyệt tham khảo, không chặn.
 */
async function findDuplicates(record: ProposalRecord): Promise<DuplicateCandidate[]> {
  const { lat, lng } = record.checkIn;
  const dLat = DUPLICATE_RADIUS_M / METERS_PER_DEGREE;
  const dLng =
    DUPLICATE_RADIUS_M / (METERS_PER_DEGREE * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
  const or: Prisma.DealerWhereInput[] = [
    { phone: record.phone },
    { ownerPhone: record.phone },
    { lat: { gte: lat - dLat, lte: lat + dLat }, lng: { gte: lng - dLng, lte: lng + dLng } },
  ];
  if (record.taxCode) or.push({ taxCode: record.taxCode });

  const dealers = await db.dealer.findMany({
    where: { mergedIntoId: null, OR: or },
    take: 20,
    select: {
      id: true,
      name: true,
      code: true,
      legacyCode: true,
      address: true,
      phone: true,
      ownerPhone: true,
      taxCode: true,
      lat: true,
      lng: true,
    },
  });
  return dealers
    .map((dealer): DuplicateCandidate => {
      const distanceM =
        dealer.lat !== null && dealer.lng !== null
          ? Math.round(distanceMeters({ lat, lng }, { lat: dealer.lat, lng: dealer.lng }))
          : null;
      const reasons: DuplicateReason[] = [];
      if (dealer.phone === record.phone || dealer.ownerPhone === record.phone)
        reasons.push('PHONE');
      if (record.taxCode && dealer.taxCode === record.taxCode) reasons.push('TAX_CODE');
      if (distanceM !== null && distanceM <= DUPLICATE_RADIUS_M) reasons.push('NEARBY');
      return {
        id: dealer.id,
        name: dealer.name,
        code: dealer.code ?? dealer.legacyCode,
        address: dealer.address,
        reasons,
        distanceM,
      };
    })
    .filter((candidate) => candidate.reasons.length > 0)
    .sort(
      (a, b) =>
        b.reasons.length - a.reasons.length ||
        (a.distanceM ?? Number.MAX_SAFE_INTEGER) - (b.distanceM ?? Number.MAX_SAFE_INTEGER),
    )
    .slice(0, MAX_DUPLICATES);
}

export async function listProposals(
  input: ListDealerProposalsInput,
): Promise<ListDealerProposalsResult> {
  const scoped = await getScopedDb();
  const pending = input.tab === 'cho-duyet';
  const where: Prisma.DealerProposalWhereInput = pending
    ? { status: 'PENDING' }
    : { status: { not: 'PENDING' } };
  const [rows, total] = await Promise.all([
    scoped.dealerProposal.findMany({
      where,
      orderBy: pending
        ? [{ createdAt: 'asc' }, { id: 'asc' }]
        : [{ reviewedAt: 'desc' }, { id: 'asc' }],
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
      select: PROPOSAL_SELECT,
    }),
    scoped.dealerProposal.count({ where }),
  ]);
  // Chỉ tìm trùng cho đề xuất chờ duyệt; đề xuất đã xử lý xem kết quả ở cột Kết quả.
  const duplicates = pending ? await Promise.all(rows.map(findDuplicates)) : rows.map(() => []);
  const now = Date.now();
  return {
    items: rows.map((row, index) => toRow(row, duplicates[index] ?? [], now)),
    total,
    page: input.page,
    pageSize: input.pageSize,
  };
}

export async function countPendingProposals(): Promise<number> {
  const scoped = await getScopedDb();
  return scoped.dealerProposal.count({ where: { status: 'PENDING' } });
}

export type ProposalOutcome = {
  proposalId: string;
  dealerId: string | null;
  dealerName: string;
  changes: AuditChanges;
};

async function loadPending(id: string) {
  const scoped = await getScopedDb();
  const proposal = await scoped.dealerProposal.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      name: true,
      proposedById: true,
      checkInId: true,
      checkIn: { select: { capturedAt: true, lat: true, lng: true } },
    },
  });
  if (!proposal) throw new DomainError('NOT_FOUND', 'Không tìm thấy đề xuất đại lý mới');
  if (proposal.status !== 'PENDING') {
    throw new DomainError('CONFLICT', 'Đề xuất này đã được xử lý, vui lòng tải lại trang');
  }
  return proposal;
}

/** Đổi trạng thái chờ duyệt trong giao dịch; hai người cùng bấm thì người sau nhận lỗi. */
async function closePending(
  tx: Prisma.TransactionClient,
  id: string,
  data: Prisma.DealerProposalUncheckedUpdateManyInput,
): Promise<void> {
  const updated = await tx.dealerProposal.updateMany({
    where: { id, status: 'PENDING' },
    data,
  });
  if (updated.count === 0) {
    throw new DomainError('CONFLICT', 'Đề xuất này đã được xử lý, vui lòng tải lại trang');
  }
}

/** Lần ghé gần nhất của đại lý cho dashboard (K0), không ghi đè lượt mới hơn. */
async function touchLastVisited(
  tx: Prisma.TransactionClient,
  dealerId: string,
  capturedAt: Date,
): Promise<void> {
  await tx.dealer.updateMany({
    where: { id: dealerId, OR: [{ lastVisitedAt: null }, { lastVisitedAt: { lt: capturedAt } }] },
    data: { lastVisitedAt: capturedAt },
  });
}

/**
 * Duyệt: tạo đại lý với toạ độ lúc chụp, chưa có mã FAST (S10 cấp mã theo dải DL). Lượt check-in kèm đề xuất
 * được gắn vào đại lý mới để tính là một lượt ghé thăm.
 */
export async function approveProposal(
  reviewerId: string,
  input: ApproveDealerProposalInput,
): Promise<ProposalOutcome> {
  const [proposal, assignable, scoped] = await Promise.all([
    loadPending(input.id),
    getAssignableOrgUnitIds(),
    getScopedDb(),
  ]);
  if (assignable && !assignable.has(input.orgUnitId)) {
    throw new DomainError('FORBIDDEN', 'Bạn không được giao đại lý cho đơn vị này');
  }
  if (input.assignedUserId) {
    const assignee = await scoped.user.findFirst({
      where: { id: input.assignedUserId, isActive: true },
      select: { id: true },
    });
    if (!assignee) throw new DomainError('VALIDATION', 'Nhân viên phụ trách không hợp lệ');
  }
  const now = new Date();
  const { capturedAt, lat, lng } = proposal.checkIn;

  const dealerId = await db.$transaction(async (tx) => {
    const dealer = await tx.dealer.create({
      data: {
        name: input.name,
        level: input.level,
        phone: input.phone,
        ownerName: input.ownerName,
        taxCode: input.taxCode,
        address: input.address,
        lat,
        lng,
        locatedAt: now,
        lastVisitedAt: capturedAt,
        orgUnitId: input.orgUnitId,
        assignedUserId: input.assignedUserId,
      },
      select: { id: true },
    });
    await closePending(tx, proposal.id, {
      status: 'APPROVED',
      dealerId: dealer.id,
      reviewedById: reviewerId,
      reviewedAt: now,
      reviewNote: '',
    });
    await tx.checkIn.update({
      where: { id: proposal.checkInId },
      data: { placeKind: 'DEALER', placeName: input.name, dealerId: dealer.id, dealerDistanceM: 0 },
    });
    return dealer.id;
  });

  notifyDealerProposalReview(proposal.proposedById, proposal.id, input.name, 'APPROVED');
  return {
    proposalId: proposal.id,
    dealerId,
    dealerName: input.name,
    changes: auditChanges(
      {},
      {
        'Tên đại lý': input.name,
        'Số điện thoại': input.phone,
        'Địa chỉ': input.address,
        Cấp: DEALER_LEVEL_LABEL[input.level],
        'Toạ độ': `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        'Từ đề xuất': proposal.name,
      },
    ),
  };
}

export async function rejectProposal(
  reviewerId: string,
  input: RejectDealerProposalInput,
): Promise<ProposalOutcome> {
  const proposal = await loadPending(input.id);
  await db.$transaction((tx) =>
    closePending(tx, proposal.id, {
      status: 'REJECTED',
      reviewedById: reviewerId,
      reviewedAt: new Date(),
      reviewNote: input.note,
    }),
  );
  notifyDealerProposalReview(proposal.proposedById, proposal.id, proposal.name, 'REJECTED');
  return {
    proposalId: proposal.id,
    dealerId: null,
    dealerName: proposal.name,
    changes: auditChanges(
      { 'Trạng thái': 'Chờ duyệt' },
      { 'Trạng thái': `Từ chối, ${input.note}` },
    ),
  };
}

/** Trùng đại lý có sẵn: không tạo đại lý mới, gắn lượt check-in vào đại lý đó. */
export async function markProposalDuplicate(
  reviewerId: string,
  input: MarkDuplicateDealerProposalInput,
): Promise<ProposalOutcome> {
  const proposal = await loadPending(input.id);
  const dealer = await db.dealer.findUnique({
    where: { id: input.dealerId },
    select: { id: true, name: true, lat: true, lng: true, mergedIntoId: true },
  });
  if (!dealer || dealer.mergedIntoId) {
    throw new DomainError('NOT_FOUND', 'Không tìm thấy đại lý có sẵn, vui lòng tải lại trang');
  }
  const { capturedAt, lat, lng } = proposal.checkIn;
  const distanceM =
    dealer.lat !== null && dealer.lng !== null
      ? distanceMeters({ lat, lng }, { lat: dealer.lat, lng: dealer.lng })
      : null;

  await db.$transaction(async (tx) => {
    await closePending(tx, proposal.id, {
      status: 'DUPLICATE',
      dealerId: dealer.id,
      reviewedById: reviewerId,
      reviewedAt: new Date(),
      reviewNote: input.note,
    });
    await tx.checkIn.update({
      where: { id: proposal.checkInId },
      data: {
        placeKind: 'DEALER',
        placeName: dealer.name,
        dealerId: dealer.id,
        dealerDistanceM: distanceM,
      },
    });
    await touchLastVisited(tx, dealer.id, capturedAt);
  });

  notifyDealerProposalReview(proposal.proposedById, proposal.id, proposal.name, 'DUPLICATE');
  return {
    proposalId: proposal.id,
    dealerId: dealer.id,
    dealerName: dealer.name,
    changes: auditChanges(
      { 'Trạng thái': 'Chờ duyệt' },
      { 'Trạng thái': `Trùng đại lý có sẵn, ${dealer.name}${input.note ? `, ${input.note}` : ''}` },
    ),
  };
}

/** Đề xuất của chính nhân viên trên app, 90 ngày gần nhất. */
export async function listMyProposals(user: MobileUser): Promise<MyDealerProposalsResult> {
  const since = new Date(Date.now() - MY_PROPOSALS_DAYS * 86_400_000);
  const rows = await db.dealerProposal.findMany({
    where: { proposedById: user.id, createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      name: true,
      address: true,
      status: true,
      reviewNote: true,
      dealer: { select: { name: true } },
      checkIn: { select: { capturedAt: true } },
    },
  });
  return {
    items: rows.map((row) => ({
      id: row.id,
      name: row.name,
      address: row.address,
      capturedAt: row.checkIn.capturedAt.toISOString(),
      status: row.status,
      reviewNote: row.reviewNote,
      dealerName: row.dealer?.name ?? null,
    })),
  };
}
