import 'server-only';
import type { Prisma } from '@prisma/client';
import { auditChanges, type AuditChanges } from '@dms/contracts/audit';
import {
  isSameStreet,
  type DealerLocationProposalRow,
  type ListDealerLocationProposalsInput,
  type ListDealerLocationProposalsResult,
  type ReviewDealerLocationInput,
} from '@dms/contracts/dealer-locations';
import { db } from '@dms/db/client';
import { getScopedDb } from '@/server/auth/scoped-db';
import { CHECK_IN_PHOTO_RETENTION_DAYS, presignGetUrl } from '@/server/integrations/object-storage';
import { DomainError } from './domain-error';

const PROPOSAL_SELECT = {
  id: true,
  lat: true,
  lng: true,
  accuracyM: true,
  status: true,
  reviewedAt: true,
  reviewNote: true,
  dealer: { select: { id: true, name: true, code: true, legacyCode: true, address: true } },
  proposedBy: { select: { fullName: true, employeeCode: true } },
  reviewedBy: { select: { fullName: true } },
  checkIn: { select: { capturedAt: true, address: true, addressOnPhoto: true, photoKey: true } },
} satisfies Prisma.DealerLocationProposalSelect;

type ProposalRecord = Prisma.DealerLocationProposalGetPayload<{ select: typeof PROPOSAL_SELECT }>;

const PHOTO_RETENTION_MS = CHECK_IN_PHOTO_RETENTION_DAYS * 86_400_000;

function toRow(record: ProposalRecord, now: number): DealerLocationProposalRow {
  const address = record.checkIn.address ?? record.checkIn.addressOnPhoto;
  const photoAlive =
    record.checkIn.photoKey && now - record.checkIn.capturedAt.getTime() < PHOTO_RETENTION_MS;
  return {
    id: record.id,
    dealerId: record.dealer.id,
    dealerName: record.dealer.name,
    dealerCode: record.dealer.code ?? record.dealer.legacyCode,
    dealerAddress: record.dealer.address,
    proposedByName: record.proposedBy.fullName,
    proposedByCode: record.proposedBy.employeeCode,
    capturedAt: record.checkIn.capturedAt.toISOString(),
    checkInAddress: address,
    lat: record.lat,
    lng: record.lng,
    accuracyM: record.accuracyM,
    sameStreet: isSameStreet(address, record.dealer.address),
    photoUrl: photoAlive && record.checkIn.photoKey ? presignGetUrl(record.checkIn.photoKey) : null,
    status: record.status,
    reviewedByName: record.reviewedBy?.fullName ?? null,
    reviewedAt: record.reviewedAt?.toISOString() ?? null,
    reviewNote: record.reviewNote,
  };
}

export async function listProposals(
  input: ListDealerLocationProposalsInput,
): Promise<ListDealerLocationProposalsResult> {
  const scoped = await getScopedDb();
  const where: Prisma.DealerLocationProposalWhereInput =
    input.tab === 'cho-duyet' ? { status: 'PENDING' } : { status: { not: 'PENDING' } };
  const [rows, total] = await Promise.all([
    scoped.dealerLocationProposal.findMany({
      where,
      orderBy:
        input.tab === 'cho-duyet'
          ? [{ createdAt: 'asc' }, { id: 'asc' }]
          : [{ reviewedAt: 'desc' }, { id: 'asc' }],
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
      select: PROPOSAL_SELECT,
    }),
    scoped.dealerLocationProposal.count({ where }),
  ]);
  const now = Date.now();
  return {
    items: rows.map((row) => toRow(row, now)),
    total,
    page: input.page,
    pageSize: input.pageSize,
  };
}

export type ReviewOutcome = {
  dealerId: string;
  dealerName: string;
  approved: boolean;
  changes: AuditChanges;
};

function coordinateText(lat: number | null, lng: number | null): string {
  return lat === null || lng === null ? 'Chưa có' : `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

/**
 * Duyệt thì ghi toạ độ vào đại lý, từ lần check-in sau so được khoảng cách. Từ chối thì lần check-in
 * sau tại đại lý đó tạo đề xuất mới. Chỉ xử lý đề xuất trong phạm vi dữ liệu của người duyệt.
 */
export async function reviewProposal(
  reviewerId: string,
  input: ReviewDealerLocationInput,
): Promise<ReviewOutcome> {
  const scoped = await getScopedDb();
  const proposal = await scoped.dealerLocationProposal.findUnique({
    where: { id: input.id },
    select: {
      id: true,
      status: true,
      lat: true,
      lng: true,
      dealer: { select: { id: true, name: true, lat: true, lng: true } },
    },
  });
  if (!proposal) throw new DomainError('NOT_FOUND', 'Không tìm thấy đề xuất toạ độ');
  if (proposal.status !== 'PENDING') {
    throw new DomainError('CONFLICT', 'Đề xuất này đã được xử lý, vui lòng tải lại trang');
  }
  const approved = input.decision === 'APPROVE';
  const now = new Date();

  await db.$transaction(async (tx) => {
    // Hai người cùng bấm: chỉ lượt đầu đổi được trạng thái chờ duyệt.
    const updated = await tx.dealerLocationProposal.updateMany({
      where: { id: proposal.id, status: 'PENDING' },
      data: {
        status: approved ? 'APPROVED' : 'REJECTED',
        reviewedById: reviewerId,
        reviewedAt: now,
        reviewNote: input.note,
      },
    });
    if (updated.count === 0) {
      throw new DomainError('CONFLICT', 'Đề xuất này đã được xử lý, vui lòng tải lại trang');
    }
    if (approved) {
      await tx.dealer.update({
        where: { id: proposal.dealer.id },
        data: { lat: proposal.lat, lng: proposal.lng, locatedAt: now },
      });
    }
  });

  const before = coordinateText(proposal.dealer.lat, proposal.dealer.lng);
  return {
    dealerId: proposal.dealer.id,
    dealerName: proposal.dealer.name,
    approved,
    changes: approved
      ? auditChanges({ 'Toạ độ': before }, { 'Toạ độ': coordinateText(proposal.lat, proposal.lng) })
      : auditChanges(
          { 'Đề xuất toạ độ': coordinateText(proposal.lat, proposal.lng) },
          { 'Đề xuất toạ độ': `Từ chối${input.note ? `, ${input.note}` : ''}` },
        ),
  };
}
