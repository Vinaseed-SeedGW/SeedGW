import 'server-only';
import type { Prisma } from '@prisma/client';
import { auditChanges, type AuditAction, type AuditChanges } from '@seedgw/contracts/audit';
import { DEALER_LEVEL_LABEL, type DealerLevel } from '@seedgw/contracts/dealers';
import {
  DUPLICATE_RADIUS_M,
  DUPLICATE_REASON_LABEL,
  MY_PROPOSALS_DAYS,
  type CreateDealerWebInput,
  type CreateDealerWebResult,
  type DealerCreateMode,
  type MobileProposalReviewList,
  type ScopedProposalsInput,
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
import type { ApprovalChainResult } from '@seedgw/contracts/approvals';
import {
  guessProvinceFromAddress,
  PROVINCES,
  type ProvinceName,
} from '@seedgw/contracts/provinces';
import { vietnamDayStart, vietnamNextDayStart } from '@seedgw/contracts/format';
import { escapeLikePattern } from '@seedgw/contracts/text';
import { distanceMeters } from '@seedgw/contracts/track-distance';
import { db } from '@seedgw/db/client';
import { getOrgUnitAncestorIds } from '@seedgw/db/org-units';
import type { MobileUser } from '@/server/auth/mobile';
import { getAssignableOrgUnitIds, getScopedDb } from '@/server/auth/scoped-db';
import { CHECK_IN_PHOTO_RETENTION_DAYS, presignGetUrl } from '@/server/integrations/object-storage';
import { DomainError } from './domain-error';
import { loadApprovalChain } from './approvals';
import { notifyDealerProposalPending, notifyDealerProposalReview } from './push-events';

// Đề xuất đại lý mới (M10). 25/11/2026: Quản lý trực tiếp hoặc Lãnh đạo đơn vị duyệt một bước; Quản trị đơn vị
// chỉ xem, Quản trị hệ thống duyệt thay; người có quyền duyệt tự đề xuất thì tạo luôn.
// 26/11/2026: thêm đại lý trên web cho mọi vai trò, đề xuất nguồn Web không kèm check-in.

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
  currentApprover: { select: { fullName: true } },
  dealer: { select: { id: true, name: true } },
  source: true,
  lat: true,
  lng: true,
  provinceName: true,
  createdAt: true,
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

type LatLng = { lat: number; lng: number };

function toLevel(value: number): DealerLevel {
  return value === 1 || value === 2 ? value : 3;
}

function asProvince(value: string | null): ProvinceName | null {
  return value && (PROVINCES as readonly string[]).includes(value) ? (value as ProvinceName) : null;
}

/** Toạ độ của đề xuất: lúc chụp nếu kèm check-in, không thì toạ độ chọn trên bản đồ khi thêm trên web. */
function pointOf(record: {
  lat: number | null;
  lng: number | null;
  checkIn: { lat: number; lng: number } | null;
}): LatLng | null {
  if (record.checkIn) return { lat: record.checkIn.lat, lng: record.checkIn.lng };
  return record.lat !== null && record.lng !== null ? { lat: record.lat, lng: record.lng } : null;
}

function toRow(
  record: ProposalRecord,
  duplicates: DuplicateCandidate[],
  now: number,
): DealerProposalRow {
  const checkIn = record.checkIn;
  const photoKey =
    checkIn?.photoKey && now - checkIn.capturedAt.getTime() < PHOTO_RETENTION_MS
      ? checkIn.photoKey
      : null;
  const point = pointOf(record);
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
    source: record.source,
    capturedAt: (checkIn?.capturedAt ?? record.createdAt).toISOString(),
    checkInAddress: checkIn ? (checkIn.address ?? checkIn.addressOnPhoto) : null,
    lat: point?.lat ?? null,
    lng: point?.lng ?? null,
    provinceName: asProvince(record.provinceName),
    accuracyM: checkIn?.accuracyM ?? null,
    photoUrl: photoKey ? presignGetUrl(photoKey) : null,
    status: record.status,
    reviewedByName: record.reviewedBy?.fullName ?? null,
    reviewedAt: record.reviewedAt?.toISOString() ?? null,
    reviewNote: record.reviewNote,
    currentApproverName: record.currentApprover?.fullName ?? null,
    dealer: record.dealer,
    duplicates,
  };
}

/**
 * Đại lý có sẵn có thể trùng: cùng số điện thoại (của đại lý hoặc chủ đại lý), cùng mã số thuế, hoặc nằm
 * trong bán kính quanh điểm chụp (hoặc toạ độ chọn trên web). Tìm trên toàn danh mục vì đại lý trùng có thể
 * thuộc đơn vị khác. Chỉ để người duyệt tham khảo, không chặn.
 */
async function findDuplicates(record: {
  phone: string;
  taxCode: string | null;
  lat: number | null;
  lng: number | null;
  checkIn: { lat: number; lng: number } | null;
}): Promise<DuplicateCandidate[]> {
  const point = pointOf(record);
  const or: Prisma.DealerWhereInput[] = [{ phone: record.phone }, { ownerPhone: record.phone }];
  if (point) {
    const dLat = DUPLICATE_RADIUS_M / METERS_PER_DEGREE;
    const dLng =
      DUPLICATE_RADIUS_M /
      (METERS_PER_DEGREE * Math.max(Math.cos((point.lat * Math.PI) / 180), 0.01));
    or.push({
      lat: { gte: point.lat - dLat, lte: point.lat + dLat },
      lng: { gte: point.lng - dLng, lte: point.lng + dLng },
    });
  }
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
        point && dealer.lat !== null && dealer.lng !== null
          ? Math.round(distanceMeters(point, { lat: dealer.lat, lng: dealer.lng }))
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
  return {
    items: await withDuplicates(rows, pending),
    total,
    page: input.page,
    pageSize: input.pageSize,
  };
}

export async function countPendingProposals(): Promise<number> {
  const scoped = await getScopedDb();
  return scoped.dealerProposal.count({ where: { status: 'PENDING' } });
}

async function withDuplicates(
  rows: ProposalRecord[],
  pending: boolean,
): Promise<DealerProposalRow[]> {
  const duplicates = pending ? await Promise.all(rows.map(findDuplicates)) : rows.map(() => []);
  const now = Date.now();
  return rows.map((row, index) => toRow(row, duplicates[index] ?? [], now));
}

/** Tab Đại lý mới ở Cần duyệt: đề xuất đang chờ chính người này duyệt, cũ nhất lên đầu. */
export async function listProposalsForApprover(
  approverId: string,
  page: number,
  pageSize: number,
): Promise<ListDealerProposalsResult> {
  const where: Prisma.DealerProposalWhereInput = {
    status: 'PENDING',
    currentApproverId: approverId,
  };
  const [rows, total] = await Promise.all([
    db.dealerProposal.findMany({
      where,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: PROPOSAL_SELECT,
    }),
    db.dealerProposal.count({ where }),
  ]);
  return { items: await withDuplicates(rows, true), total, page, pageSize };
}

export async function countProposalsForApprover(approverId: string): Promise<number> {
  return db.dealerProposal.count({ where: { status: 'PENDING', currentApproverId: approverId } });
}

/** Trang Đại lý đề xuất: nhân viên thấy của mình, Quản lý và Lãnh đạo thấy theo phạm vi. */
export async function listScopedProposals(
  input: ScopedProposalsInput,
): Promise<ListDealerProposalsResult> {
  const scoped = await getScopedDb();
  const search = input.q ? escapeLikePattern(input.q) : '';
  const where: Prisma.DealerProposalWhereInput = {
    ...(input.status ? { status: input.status } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search } },
            { address: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
    // Đề xuất kèm check-in lọc theo giờ chụp, đề xuất từ web lọc theo giờ gửi.
    ...(input.from || input.to
      ? (() => {
          const range = {
            ...(input.from ? { gte: vietnamDayStart(input.from) } : {}),
            ...(input.to ? { lt: vietnamNextDayStart(input.to) } : {}),
          };
          return {
            AND: [
              { OR: [{ checkIn: { capturedAt: range } }, { checkInId: null, createdAt: range }] },
            ],
          };
        })()
      : {}),
  };
  const [rows, total] = await Promise.all([
    scoped.dealerProposal.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
      select: PROPOSAL_SELECT,
    }),
    scoped.dealerProposal.count({ where }),
  ]);
  return {
    items: await withDuplicates(rows, false),
    total,
    page: input.page,
    pageSize: input.pageSize,
  };
}

const MOBILE_REVIEW_LIMIT = 50;

/** Mục Đại lý mới trong Cần duyệt trên app: tối đa 50 đề xuất chờ người này duyệt. */
export async function listMobileProposalReview(
  approverId: string,
): Promise<MobileProposalReviewList> {
  const { items } = await listProposalsForApprover(approverId, 1, MOBILE_REVIEW_LIMIT);
  return {
    items: items.map((row) => ({
      id: row.id,
      name: row.name,
      phone: row.phone,
      address: row.address,
      ownerName: row.ownerName,
      taxCode: row.taxCode,
      levelLabel: DEALER_LEVEL_LABEL[row.level],
      proposedByName: row.proposedByName,
      capturedAt: row.capturedAt,
      checkInAddress: row.checkInAddress,
      duplicates: row.duplicates.map((candidate) => ({
        name: candidate.name,
        reasons: candidate.reasons.map((reason) => DUPLICATE_REASON_LABEL[reason]).join(', '),
      })),
    })),
  };
}

export type ProposalOutcome = {
  proposalId: string;
  dealerId: string | null;
  dealerName: string;
  changes: AuditChanges;
};

/** Người quyết định đề xuất: tài khoản web hoặc app, chỉ cần mã và quyền. */
export type ProposalDecider = { id: string; permissions: ReadonlySet<string> };

type DecisionMode = 'APPROVER' | 'OVERRIDE';

const PENDING_SELECT = {
  id: true,
  status: true,
  name: true,
  phone: true,
  address: true,
  ownerName: true,
  taxCode: true,
  level: true,
  orgUnitId: true,
  proposedById: true,
  currentApproverId: true,
  checkInId: true,
  lat: true,
  lng: true,
  provinceName: true,
  proposedBy: { select: { isActive: true } },
  checkIn: {
    select: { capturedAt: true, lat: true, lng: true, address: true, addressOnPhoto: true },
  },
} satisfies Prisma.DealerProposalSelect;

type PendingProposal = Prisma.DealerProposalGetPayload<{ select: typeof PENDING_SELECT }>;

const STALE_MESSAGE = 'Đề xuất này đã được xử lý, vui lòng tải lại trang';

async function loadPending(id: string): Promise<PendingProposal> {
  const proposal = await db.dealerProposal.findUnique({ where: { id }, select: PENDING_SELECT });
  if (!proposal) throw new DomainError('NOT_FOUND', 'Không tìm thấy đề xuất đại lý mới');
  if (proposal.status !== 'PENDING') throw new DomainError('CONFLICT', STALE_MESSAGE);
  return proposal;
}

/**
 * Người đang được giao duyệt thì duyệt; Quản trị hệ thống (quyền duyệt thay) duyệt thay trên web.
 * Quản trị đơn vị chỉ xem, giống Tuyến và Chỉ tiêu.
 */
function decisionMode(
  actor: ProposalDecider,
  proposal: PendingProposal,
  allowOverride: boolean,
): DecisionMode {
  if (proposal.currentApproverId === actor.id && actor.permissions.has('sales.approval.review')) {
    return 'APPROVER';
  }
  if (allowOverride && actor.permissions.has('sales.approval.override')) return 'OVERRIDE';
  throw new DomainError('FORBIDDEN', 'Đề xuất này không chờ bạn duyệt');
}

function withOverrideNote(mode: DecisionMode, note: string): string {
  if (mode !== 'OVERRIDE') return note;
  return note ? `Duyệt thay, ${note}` : 'Duyệt thay';
}

/** Đổi trạng thái chờ duyệt trong giao dịch; hai người cùng bấm thì người sau nhận lỗi. */
async function closePending(
  tx: Prisma.TransactionClient,
  id: string,
  data: Prisma.DealerProposalUncheckedUpdateManyInput,
): Promise<void> {
  const updated = await tx.dealerProposal.updateMany({
    where: { id, status: 'PENDING' },
    data: { ...data, currentApproverId: null },
  });
  if (updated.count === 0) throw new DomainError('CONFLICT', STALE_MESSAGE);
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

type DealerValues = Omit<ApproveDealerProposalInput, 'id'>;

async function assertAssignee(assignedUserId: string | null, orgUnitId: string): Promise<void> {
  if (!assignedUserId) return;
  const assignee = await db.user.findFirst({
    where: { id: assignedUserId, isActive: true },
    select: { orgUnitId: true },
  });
  if (!assignee) throw new DomainError('VALIDATION', 'Nhân viên phụ trách không hợp lệ');
  // K7b: nhân viên phải thuộc đơn vị phụ trách đại lý hoặc đơn vị con của nó.
  const unitPath = assignee.orgUnitId ? await getOrgUnitAncestorIds(assignee.orgUnitId) : [];
  if (!unitPath.includes(orgUnitId)) {
    throw new DomainError('VALIDATION', 'Nhân viên không thuộc đơn vị phụ trách đã chọn', {
      assignedUserId: 'Chọn nhân viên thuộc đơn vị phụ trách, hoặc để Chưa giao',
    });
  }
}

/**
 * Tạo đại lý với toạ độ lúc chụp (hoặc toạ độ chọn trên web), chưa có mã FAST (S10 cấp mã theo dải DL).
 * Lượt check-in kèm đề xuất được gắn vào đại lý mới để tính là một lượt ghé thăm. Đề xuất từ web chưa có
 * toạ độ thì để lần check-in đầu tiên tại đại lý đề xuất toạ độ (M4).
 */
async function createDealerFromProposal(
  proposal: PendingProposal,
  values: DealerValues,
  reviewerId: string,
  note: string,
  notify: boolean,
): Promise<ProposalOutcome> {
  const now = new Date();
  const point = pointOf(proposal);
  const checkInId = proposal.checkInId;
  const dealerId = await db.$transaction(async (tx) => {
    const dealer = await tx.dealer.create({
      data: {
        name: values.name,
        level: values.level,
        phone: values.phone,
        ownerName: values.ownerName,
        taxCode: values.taxCode,
        address: values.address,
        provinceName: values.provinceName,
        lat: point?.lat ?? null,
        lng: point?.lng ?? null,
        locatedAt: point ? now : null,
        lastVisitedAt: proposal.checkIn?.capturedAt ?? null,
        orgUnitId: values.orgUnitId,
        assignedUserId: values.assignedUserId,
      },
      select: { id: true },
    });
    await closePending(tx, proposal.id, {
      status: 'APPROVED',
      dealerId: dealer.id,
      reviewedById: reviewerId,
      reviewedAt: now,
      reviewNote: note,
    });
    if (checkInId) {
      await tx.checkIn.update({
        where: { id: checkInId },
        data: {
          placeKind: 'DEALER',
          placeName: values.name,
          dealerId: dealer.id,
          dealerDistanceM: 0,
        },
      });
    }
    return dealer.id;
  });

  if (notify)
    notifyDealerProposalReview(proposal.proposedById, proposal.id, values.name, 'APPROVED');
  return {
    proposalId: proposal.id,
    dealerId,
    dealerName: values.name,
    changes: auditChanges(
      {},
      {
        'Tên đại lý': values.name,
        'Số điện thoại': values.phone,
        'Địa chỉ': values.address,
        Tỉnh: values.provinceName,
        Cấp: DEALER_LEVEL_LABEL[values.level],
        'Toạ độ': point ? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}` : 'Chưa có',
        'Từ đề xuất': proposal.name,
        ...(note ? { 'Ghi chú': note } : {}),
      },
    ),
  };
}

async function attachToExistingDealer(
  proposal: PendingProposal,
  dealer: { id: string; name: string; lat: number | null; lng: number | null },
  reviewerId: string,
  note: string,
  notify: boolean,
): Promise<ProposalOutcome> {
  const checkIn = proposal.checkIn;
  const checkInId = proposal.checkInId;
  const distanceM =
    checkIn && dealer.lat !== null && dealer.lng !== null
      ? distanceMeters(checkIn, { lat: dealer.lat, lng: dealer.lng })
      : null;

  await db.$transaction(async (tx) => {
    await closePending(tx, proposal.id, {
      status: 'DUPLICATE',
      dealerId: dealer.id,
      reviewedById: reviewerId,
      reviewedAt: new Date(),
      reviewNote: note,
    });
    // Đề xuất từ web không có lượt check-in để gắn vào đại lý có sẵn.
    if (checkIn && checkInId) {
      await tx.checkIn.update({
        where: { id: checkInId },
        data: {
          placeKind: 'DEALER',
          placeName: dealer.name,
          dealerId: dealer.id,
          dealerDistanceM: distanceM,
        },
      });
      await touchLastVisited(tx, dealer.id, checkIn.capturedAt);
    }
  });

  if (notify)
    notifyDealerProposalReview(proposal.proposedById, proposal.id, proposal.name, 'DUPLICATE');
  return {
    proposalId: proposal.id,
    dealerId: dealer.id,
    dealerName: dealer.name,
    changes: auditChanges(
      { 'Trạng thái': 'Chờ duyệt' },
      { 'Trạng thái': `Trùng đại lý có sẵn, ${dealer.name}${note ? `, ${note}` : ''}` },
    ),
  };
}

/** Thông tin như nhân viên đề xuất; đơn vị là đơn vị lúc đề xuất, người phụ trách là người đề xuất. */
function valuesAsProposed(proposal: PendingProposal, orgUnitId: string): DealerValues {
  const captured = proposal.checkIn?.address ?? proposal.checkIn?.addressOnPhoto ?? '';
  return {
    name: proposal.name,
    phone: proposal.phone,
    address: proposal.address,
    ownerName: proposal.ownerName,
    taxCode: proposal.taxCode,
    level: toLevel(proposal.level),
    provinceName:
      asProvince(proposal.provinceName) ??
      guessProvinceFromAddress(proposal.address) ??
      guessProvinceFromAddress(captured),
    orgUnitId,
    assignedUserId: proposal.proposedBy.isActive ? proposal.proposedById : null,
  };
}

/** Duyệt trên web: người duyệt được sửa thông tin; đơn vị giữ theo đơn vị của người đề xuất. */
export async function approveProposal(
  actor: ProposalDecider,
  input: ApproveDealerProposalInput,
): Promise<ProposalOutcome> {
  const proposal = await loadPending(input.id);
  const mode = decisionMode(actor, proposal, true);
  const orgUnitId =
    mode === 'APPROVER' && proposal.orgUnitId ? proposal.orgUnitId : input.orgUnitId;
  if (mode === 'OVERRIDE') {
    const assignable = await getAssignableOrgUnitIds();
    if (assignable && !assignable.has(orgUnitId)) {
      throw new DomainError('FORBIDDEN', 'Bạn không được giao đại lý cho đơn vị này');
    }
  }
  await assertAssignee(input.assignedUserId, orgUnitId);
  return createDealerFromProposal(
    proposal,
    { ...input, orgUnitId },
    actor.id,
    withOverrideNote(mode, ''),
    true,
  );
}

export async function rejectProposal(
  actor: ProposalDecider,
  input: RejectDealerProposalInput,
  allowOverride = true,
): Promise<ProposalOutcome> {
  const proposal = await loadPending(input.id);
  const note = withOverrideNote(decisionMode(actor, proposal, allowOverride), input.note);
  await db.$transaction((tx) =>
    closePending(tx, proposal.id, {
      status: 'REJECTED',
      reviewedById: actor.id,
      reviewedAt: new Date(),
      reviewNote: note,
    }),
  );
  notifyDealerProposalReview(proposal.proposedById, proposal.id, proposal.name, 'REJECTED');
  return {
    proposalId: proposal.id,
    dealerId: null,
    dealerName: proposal.name,
    changes: auditChanges({ 'Trạng thái': 'Chờ duyệt' }, { 'Trạng thái': `Từ chối, ${note}` }),
  };
}

/** Trùng đại lý có sẵn: không tạo đại lý mới, gắn lượt check-in vào đại lý đó. */
export async function markProposalDuplicate(
  actor: ProposalDecider,
  input: MarkDuplicateDealerProposalInput,
): Promise<ProposalOutcome> {
  const proposal = await loadPending(input.id);
  const mode = decisionMode(actor, proposal, true);
  const dealer = await db.dealer.findUnique({
    where: { id: input.dealerId },
    select: { id: true, name: true, lat: true, lng: true, mergedIntoId: true },
  });
  if (!dealer || dealer.mergedIntoId) {
    throw new DomainError('NOT_FOUND', 'Không tìm thấy đại lý có sẵn, vui lòng tải lại trang');
  }
  return attachToExistingDealer(
    proposal,
    dealer,
    actor.id,
    withOverrideNote(mode, input.note),
    true,
  );
}

/** Duyệt nhanh trên app: giữ nguyên thông tin như đề xuất. App không duyệt thay. */
export async function approveProposalAsProposed(
  actor: ProposalDecider,
  id: string,
): Promise<ProposalOutcome> {
  const proposal = await loadPending(id);
  decisionMode(actor, proposal, false);
  if (!proposal.orgUnitId) {
    throw new DomainError('CONFLICT', 'Người đề xuất chưa có đơn vị, vui lòng duyệt trên web');
  }
  return createDealerFromProposal(
    proposal,
    valuesAsProposed(proposal, proposal.orgUnitId),
    actor.id,
    '',
    true,
  );
}

/**
 * Người có quyền duyệt (Quản lý, Lãnh đạo đơn vị) tự đề xuất thì tạo đại lý luôn. Trùng số điện thoại
 * hoặc mã số thuế với đại lý có sẵn thì gắn lượt check-in vào đại lý đó thay vì tạo trùng.
 * Trả về null khi không tự duyệt được (chưa có đơn vị), đề xuất khi đó chờ Quản trị hệ thống.
 */
export type AutoApproveResult = {
  outcome: ProposalOutcome;
  action: 'dealer.proposal.approve' | 'dealer.proposal.duplicate';
};

export async function autoApproveOwnProposal(checkInId: string): Promise<AutoApproveResult | null> {
  const proposal = await db.dealerProposal.findUnique({
    where: { checkInId },
    select: PENDING_SELECT,
  });
  if (!proposal || proposal.status !== 'PENDING' || !proposal.orgUnitId) return null;
  return createOrAttach(
    proposal,
    valuesAsProposed(proposal, proposal.orgUnitId),
    proposal.proposedById,
    'Tự duyệt, người đề xuất có quyền duyệt',
  );
}

/**
 * Tạo đại lý luôn; trùng số điện thoại hoặc mã số thuế với đại lý có sẵn thì gắn vào đại lý đó thay vì tạo
 * trùng.
 */
async function createOrAttach(
  proposal: PendingProposal,
  values: DealerValues,
  actorId: string,
  note: string,
): Promise<AutoApproveResult & { exactReason: 'PHONE' | 'TAX_CODE' | null }> {
  const candidates = await findDuplicates(proposal);
  const exact = candidates.find(
    (candidate) => candidate.reasons.includes('PHONE') || candidate.reasons.includes('TAX_CODE'),
  );
  if (exact) {
    const dealer = await db.dealer.findUnique({
      where: { id: exact.id },
      select: { id: true, name: true, lat: true, lng: true },
    });
    if (dealer) {
      const reason = exact.reasons.includes('PHONE') ? 'PHONE' : 'TAX_CODE';
      const why = reason === 'PHONE' ? 'số điện thoại' : 'mã số thuế';
      const outcome = await attachToExistingDealer(
        proposal,
        dealer,
        actorId,
        `Tự gắn vào đại lý có sẵn vì trùng ${why}`,
        false,
      );
      return { outcome, action: 'dealer.proposal.duplicate', exactReason: reason };
    }
  }
  const outcome = await createDealerFromProposal(proposal, values, actorId, note, false);
  return { outcome, action: 'dealer.proposal.approve', exactReason: null };
}

// ---------- Web: Thêm đại lý (26/11/2026) ----------

/** Người thêm đại lý trên web: chỉ cần mã, đơn vị và quyền. */
export type DealerCreator = {
  id: string;
  orgUnitId: string | null;
  permissions: ReadonlySet<string>;
};

/**
 * Cách xử lý khi người này thêm đại lý trên web. Quản trị đơn vị, Quản trị hệ thống (quyền duyệt đại lý mới ở
 * Quản trị) tạo luôn và chọn đơn vị; người có quyền duyệt, hoặc tự là người duyệt theo chuỗi, tạo luôn trong
 * đơn vị của mình; còn lại chờ người duyệt đầu tiên trong chuỗi.
 */
export async function resolveDealerCreateMode(
  creator: DealerCreator,
): Promise<{ mode: DealerCreateMode; approverId: string | null }> {
  if (creator.permissions.has('admin.dealer-proposal.approve')) {
    return { mode: 'ASSIGN', approverId: null };
  }
  if (creator.permissions.has('sales.approval.review')) return { mode: 'DIRECT', approverId: null };
  const approverId = await resolveProposalApprover(creator.id);
  return approverId === creator.id
    ? { mode: 'DIRECT', approverId: null }
    : { mode: 'APPROVAL', approverId };
}

export type CreateDealerWebOutcome = {
  result: CreateDealerWebResult;
  audits: { action: AuditAction; outcome: ProposalOutcome }[];
};

/**
 * Thêm đại lý trên web. Luôn lưu một đề xuất nguồn Web để có lịch sử ở trang Đại lý đề xuất, rồi tạo đại lý
 * luôn hoặc chờ duyệt tuỳ người thêm.
 */
export async function createDealerFromWeb(
  creator: DealerCreator,
  input: CreateDealerWebInput,
): Promise<CreateDealerWebOutcome> {
  const { mode, approverId } = await resolveDealerCreateMode(creator);

  let orgUnitId = creator.orgUnitId;
  if (mode === 'ASSIGN') {
    if (!input.orgUnitId) {
      throw new DomainError('VALIDATION', 'Chọn đơn vị phụ trách', {
        orgUnitId: 'Chọn đơn vị phụ trách',
      });
    }
    const assignable = await getAssignableOrgUnitIds();
    if (assignable && !assignable.has(input.orgUnitId)) {
      throw new DomainError('FORBIDDEN', 'Bạn không được giao đại lý cho đơn vị này');
    }
    await assertAssignee(input.assignedUserId, input.orgUnitId);
    orgUnitId = input.orgUnitId;
  }

  const created = await db.dealerProposal.create({
    data: {
      source: 'WEB',
      checkInId: null,
      orgUnitId,
      proposedById: creator.id,
      name: input.name,
      phone: input.phone,
      address: input.address,
      ownerName: input.ownerName,
      taxCode: input.taxCode,
      level: input.level,
      provinceName: input.provinceName,
      lat: input.lat,
      lng: input.lng,
      currentApproverId: mode === 'APPROVAL' ? approverId : null,
    },
    select: PENDING_SELECT,
  });
  const createdAudit: ProposalOutcome = {
    proposalId: created.id,
    dealerId: null,
    dealerName: input.name,
    changes: auditChanges(
      {},
      {
        'Tên đại lý': input.name,
        'Số điện thoại': input.phone,
        'Địa chỉ': input.address,
        Tỉnh: input.provinceName,
        Cấp: DEALER_LEVEL_LABEL[input.level],
        'Toạ độ':
          input.lat !== null && input.lng !== null
            ? `${input.lat.toFixed(5)}, ${input.lng.toFixed(5)}`
            : 'Chưa có',
      },
    ),
  };
  const audits: CreateDealerWebOutcome['audits'] = [
    { action: 'dealer.proposal.create', outcome: createdAudit },
  ];

  // Nhân viên chờ duyệt; người tạo luôn mà chưa có đơn vị thì cũng để Quản trị hệ thống duyệt thay.
  if (mode === 'APPROVAL' || !orgUnitId) {
    if (approverId) notifyProposalApprover(approverId, created.id);
    const approver = approverId
      ? await db.user.findUnique({ where: { id: approverId }, select: { fullName: true } })
      : null;
    return {
      result: {
        outcome: 'PENDING',
        proposalId: created.id,
        dealerId: null,
        message: approver
          ? `Đã gửi đề xuất, chờ ${approver.fullName} duyệt`
          : 'Đã gửi đề xuất, chưa có người duyệt nên Quản trị hệ thống sẽ duyệt thay',
      },
      audits,
    };
  }

  const values: DealerValues =
    mode === 'ASSIGN'
      ? {
          name: input.name,
          phone: input.phone,
          address: input.address,
          ownerName: input.ownerName,
          taxCode: input.taxCode,
          level: input.level,
          provinceName: input.provinceName,
          orgUnitId,
          assignedUserId: input.assignedUserId,
        }
      : valuesAsProposed(created, orgUnitId);
  const done = await createOrAttach(created, values, creator.id, 'Thêm trên web, tạo luôn');
  audits.push({ action: done.action, outcome: done.outcome });
  return {
    result: done.exactReason
      ? {
          outcome: 'ATTACHED',
          proposalId: created.id,
          dealerId: done.outcome.dealerId,
          message: `Đã có đại lý ${done.outcome.dealerName} cùng ${
            done.exactReason === 'PHONE' ? 'số điện thoại' : 'mã số thuế'
          }, không tạo đại lý mới`,
        }
      : {
          outcome: 'CREATED',
          proposalId: created.id,
          dealerId: done.outcome.dealerId,
          message: 'Đã thêm đại lý',
        },
    audits,
  };
}

/** Người duyệt đầu tiên trong chuỗi (Quản lý trực tiếp nếu đơn vị có cấp Quản lý, không thì Lãnh đạo). */
function approverOf(chain: ApprovalChainResult, proposerId: string): string | null {
  if (!chain.ok) return null;
  if (chain.mode === 'SELF_APPROVED') return proposerId;
  return chain.managerApproverId ?? chain.leaderApproverId;
}

export async function resolveProposalApprover(proposerId: string): Promise<string | null> {
  const { chain } = await loadApprovalChain(db, proposerId);
  return approverOf(chain, proposerId);
}

/**
 * Gọi khi đổi cơ cấu (cùng lúc với phiếu Tuyến, Chỉ tiêu): đề xuất đang chờ chuyển sang người duyệt mới.
 * Không tìm được người duyệt thì để trống, Quản trị hệ thống duyệt thay.
 */
export async function refreshProposalApprovers(): Promise<number> {
  const pending = await db.dealerProposal.findMany({
    where: { status: 'PENDING' },
    select: { id: true, proposedById: true, currentApproverId: true },
  });
  let changed = 0;
  for (const proposal of pending) {
    const approverId = await resolveProposalApprover(proposal.proposedById);
    if (approverId === proposal.currentApproverId) continue;
    const updated = await db.dealerProposal.updateMany({
      where: { id: proposal.id, status: 'PENDING', currentApproverId: proposal.currentApproverId },
      data: { currentApproverId: approverId },
    });
    changed += updated.count;
    if (approverId && updated.count > 0) notifyProposalApprover(approverId, proposal.id);
  }
  return changed;
}

/** Báo người duyệt có đề xuất mới; gọi sau khi lưu check-in kèm đề xuất. */
export function notifyProposalApprover(approverId: string, proposalId: string): void {
  void db.dealerProposal
    .findUnique({
      where: { id: proposalId },
      select: { name: true, proposedBy: { select: { fullName: true } } },
    })
    .then((row) => {
      if (row)
        notifyDealerProposalPending(approverId, proposalId, row.name, row.proposedBy.fullName);
    })
    .catch((error: unknown) => console.error('Khong bao duoc nguoi duyet dai ly moi', error));
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
      createdAt: true,
      checkIn: { select: { capturedAt: true } },
    },
  });
  return {
    items: rows.map((row) => ({
      id: row.id,
      name: row.name,
      address: row.address,
      capturedAt: (row.checkIn?.capturedAt ?? row.createdAt).toISOString(),
      status: row.status,
      reviewNote: row.reviewNote,
      dealerName: row.dealer?.name ?? null,
    })),
  };
}
