'use client';

import { useState } from 'react';
import { Image as ImageIcon, MapPin } from 'lucide-react';
import {
  DEALER_PROPOSAL_STATUS_LABEL,
  type DealerProposalOptions,
  type DealerProposalRow,
  type DealerProposalTab,
  type ListDealerProposalsResult,
} from '@seedgw/contracts/dealer-proposals';
import { DEALER_LEVEL_LABEL } from '@seedgw/contracts/dealers';
import { formatDateTime, formatNumber } from '@seedgw/contracts/format';
import { DataTable, type ColumnDef } from '@seedgw/ui/data-table';
import {
  ApproveProposalSheet,
  DuplicateList,
  DuplicateProposalDialog,
  RejectProposalDialog,
} from './dealer-proposal-dialogs';

const SECONDARY_COLUMN = 'max-md:hidden';
const WRAP_COLUMN = 'min-w-56 whitespace-normal!';
const PRIMARY_BUTTON =
  'inline-flex h-9.5 items-center rounded-md bg-brand px-3 font-bold text-primary-foreground hover:bg-brand-hover';
const SECONDARY_BUTTON =
  'inline-flex h-9.5 items-center rounded-md border border-border bg-surface px-3 font-bold hover:bg-brand-soft';

type Review = { row: DealerProposalRow; kind: 'approve' | 'reject' | 'duplicate' };

function mapsUrl(row: DealerProposalRow): string {
  return `https://www.google.com/maps/search/?api=1&query=${row.lat},${row.lng}`;
}

function ResultCell({ row }: { row: DealerProposalRow }) {
  return (
    <>
      <span className="font-bold">{DEALER_PROPOSAL_STATUS_LABEL[row.status]}</span>
      {row.dealer ? (
        <a href={`/quan-tri/dai-ly/${row.dealer.id}`} className="block text-sm text-brand">
          {row.dealer.name}
        </a>
      ) : null}
      <span className="block text-sm text-text-muted">
        {row.reviewedByName ?? ''}
        {row.reviewedAt ? `, ${formatDateTime(row.reviewedAt)}` : ''}
      </span>
      {row.reviewNote ? <span className="block text-sm">{row.reviewNote}</span> : null}
    </>
  );
}

function columns(
  tab: DealerProposalTab,
  onReview: (review: Review) => void,
): ColumnDef<DealerProposalRow>[] {
  const pending = tab === 'cho-duyet';
  const base: ColumnDef<DealerProposalRow>[] = [
    {
      accessorKey: 'name',
      header: 'Đại lý đề xuất',
      meta: { label: 'Đại lý đề xuất', className: WRAP_COLUMN },
      cell: ({ row }) => (
        <>
          <span className="font-bold">{row.original.name}</span>
          <span className="block text-sm">
            {row.original.phone}, {DEALER_LEVEL_LABEL[row.original.level]}
          </span>
          {row.original.ownerName ? (
            <span className="block text-sm">Chủ đại lý: {row.original.ownerName}</span>
          ) : null}
          {row.original.taxCode ? (
            <span className="block text-sm">Mã số thuế: {row.original.taxCode}</span>
          ) : null}
          <span className="block text-sm text-text-muted">{row.original.address}</span>
        </>
      ),
    },
    {
      id: 'location',
      header: 'Vị trí lúc chụp',
      meta: { label: 'Vị trí lúc chụp', className: WRAP_COLUMN },
      cell: ({ row }) => (
        <>
          {row.original.checkInAddress ?? (
            <span className="text-text-muted">Chưa lấy được địa chỉ</span>
          )}
          <a
            href={mapsUrl(row.original)}
            target="_blank"
            rel="noreferrer"
            className="mt-1 flex items-center gap-1 text-sm text-brand"
          >
            <MapPin size={14} aria-hidden />
            Xem trên bản đồ
            {row.original.accuracyM !== null
              ? `, sai số ${formatNumber(Math.round(row.original.accuracyM))} m`
              : ''}
          </a>
          {row.original.photoUrl ? (
            <a
              href={row.original.photoUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 flex items-center gap-1 text-sm font-bold text-brand"
            >
              <ImageIcon size={14} aria-hidden />
              Xem ảnh
            </a>
          ) : (
            <span className="block text-sm text-text-muted">Ảnh chưa có hoặc đã hết hạn lưu</span>
          )}
        </>
      ),
    },
    {
      accessorKey: 'proposedByName',
      header: 'Nhân viên',
      meta: { label: 'Nhân viên', className: SECONDARY_COLUMN },
      cell: ({ row }) => (
        <>
          {row.original.proposedByName}
          <span className="block text-sm text-text-muted">
            {row.original.proposedByCode}, {formatDateTime(row.original.capturedAt)}
          </span>
          {row.original.orgUnitName ? (
            <span className="block text-sm text-text-muted">{row.original.orgUnitName}</span>
          ) : null}
        </>
      ),
    },
  ];
  if (!pending) {
    return [
      ...base,
      {
        accessorKey: 'status',
        header: 'Kết quả',
        meta: { label: 'Kết quả', className: WRAP_COLUMN },
        cell: ({ row }) => <ResultCell row={row.original} />,
      },
    ];
  }
  return [
    ...base,
    {
      id: 'duplicates',
      header: 'Có thể trùng',
      meta: { label: 'Có thể trùng', className: WRAP_COLUMN },
      cell: ({ row }) => <DuplicateList row={row.original} />,
    },
    {
      id: 'actions',
      header: 'Xử lý',
      meta: { label: 'Xử lý' },
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onReview({ row: row.original, kind: 'approve' })}
            className={PRIMARY_BUTTON}
          >
            Duyệt
          </button>
          {row.original.duplicates.length > 0 ? (
            <button
              type="button"
              onClick={() => onReview({ row: row.original, kind: 'duplicate' })}
              className={SECONDARY_BUTTON}
            >
              Trùng
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => onReview({ row: row.original, kind: 'reject' })}
            className={SECONDARY_BUTTON}
          >
            Từ chối
          </button>
        </div>
      ),
    },
  ];
}

function getProposalId(row: DealerProposalRow) {
  return row.id;
}

type Props = {
  data: ListDealerProposalsResult;
  tab: DealerProposalTab;
  options: DealerProposalOptions;
};

export function DealerProposalsTable({ data, tab, options }: Props) {
  const [review, setReview] = useState<Review | null>(null);
  const close = () => setReview(null);
  return (
    <DataTable.Root
      columns={columns(tab, setReview)}
      data={data.items}
      getRowId={getProposalId}
      total={data.total}
      page={data.page}
      pageSize={data.pageSize}
    >
      <DataTable.Body
        emptyMessage={
          tab === 'cho-duyet'
            ? 'Không có đề xuất đại lý mới nào chờ duyệt.'
            : 'Chưa có đề xuất đại lý mới nào được xử lý.'
        }
      />
      <DataTable.Pagination itemLabel="đề xuất" />
      {review?.kind === 'approve' ? (
        <ApproveProposalSheet row={review.row} options={options} onClose={close} />
      ) : null}
      {review?.kind === 'reject' ? <RejectProposalDialog row={review.row} onClose={close} /> : null}
      {review?.kind === 'duplicate' ? (
        <DuplicateProposalDialog row={review.row} onClose={close} />
      ) : null}
    </DataTable.Root>
  );
}
