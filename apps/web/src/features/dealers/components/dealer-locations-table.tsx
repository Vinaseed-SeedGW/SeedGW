'use client';

import { useState } from 'react';
import { Image as ImageIcon, MapPin } from 'lucide-react';
import {
  DEALER_LOCATION_STATUS_LABEL,
  type DealerLocationProposalRow,
  type DealerLocationTab,
  type ListDealerLocationProposalsResult,
} from '@dms/contracts/dealer-locations';
import { formatDateTime, formatNumber } from '@dms/contracts/format';
import { ConfirmDialog } from '@dms/ui/confirm-dialog';
import { DataTable, type ColumnDef } from '@dms/ui/data-table';
import { reviewDealerLocationAction } from '@/server/actions/dealer-locations';

const SECONDARY_COLUMN = 'max-md:hidden';
const WRAP_COLUMN = 'min-w-56 whitespace-normal!';

type Review = { row: DealerLocationProposalRow; decision: 'APPROVE' | 'REJECT' };

function mapsUrl(row: DealerLocationProposalRow): string {
  return `https://www.google.com/maps/search/?api=1&query=${row.lat},${row.lng}`;
}

function StreetBadge({ sameStreet }: { sameStreet: boolean | null }) {
  if (sameStreet === null) {
    return <span className="block text-sm text-text-muted">Không đủ địa chỉ để so tên phố</span>;
  }
  return (
    <span
      className={`mt-1 inline-block rounded-sm px-1.5 text-sm ${sameStreet ? 'bg-brand-soft' : 'bg-warning-soft'}`}
    >
      {sameStreet ? 'Cùng phố với địa chỉ đại lý' : 'Khác phố với địa chỉ đại lý'}
    </span>
  );
}

function columns(
  tab: DealerLocationTab,
  onReview: (review: Review) => void,
): ColumnDef<DealerLocationProposalRow>[] {
  return [
    {
      accessorKey: 'dealerName',
      header: 'Đại lý',
      meta: { label: 'Đại lý', className: WRAP_COLUMN },
      cell: ({ row }) => (
        <>
          <span className="font-bold">{row.original.dealerName}</span>
          {row.original.dealerCode ? (
            <span className="block text-sm text-text-muted">{row.original.dealerCode}</span>
          ) : null}
          <span className="block text-sm">
            Địa chỉ trong danh mục: {row.original.dealerAddress}
          </span>
        </>
      ),
    },
    {
      id: 'location',
      header: 'Vị trí lúc check-in',
      meta: { label: 'Vị trí lúc check-in', className: WRAP_COLUMN },
      cell: ({ row }) => (
        <>
          {row.original.checkInAddress ?? (
            <span className="text-text-muted">Chưa lấy được địa chỉ</span>
          )}
          <StreetBadge sameStreet={row.original.sameStreet} />
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
        </>
      ),
    },
    {
      id: 'photo',
      header: 'Ảnh',
      meta: { label: 'Ảnh' },
      cell: ({ row }) =>
        row.original.photoUrl ? (
          <a
            href={row.original.photoUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-bold text-brand"
          >
            <ImageIcon size={16} aria-hidden />
            Xem ảnh
          </a>
        ) : (
          <span className="text-sm text-text-muted">Chưa có hoặc đã hết hạn lưu</span>
        ),
    },
    tab === 'cho-duyet'
      ? {
          id: 'actions',
          header: 'Xử lý',
          meta: { label: 'Xử lý' },
          cell: ({ row }) => (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onReview({ row: row.original, decision: 'APPROVE' })}
                className="inline-flex h-9.5 items-center rounded-md bg-brand px-3 font-bold text-primary-foreground hover:bg-brand-hover"
              >
                Duyệt
              </button>
              <button
                type="button"
                onClick={() => onReview({ row: row.original, decision: 'REJECT' })}
                className="inline-flex h-9.5 items-center rounded-md border border-border bg-surface px-3 font-bold hover:bg-brand-soft"
              >
                Từ chối
              </button>
            </div>
          ),
        }
      : {
          accessorKey: 'status',
          header: 'Kết quả',
          meta: { label: 'Kết quả', className: WRAP_COLUMN },
          cell: ({ row }) => (
            <>
              <span className="font-bold">{DEALER_LOCATION_STATUS_LABEL[row.original.status]}</span>
              <span className="block text-sm text-text-muted">
                {row.original.reviewedByName ?? ''}
                {row.original.reviewedAt ? `, ${formatDateTime(row.original.reviewedAt)}` : ''}
              </span>
              {row.original.reviewNote ? (
                <span className="block text-sm">{row.original.reviewNote}</span>
              ) : null}
            </>
          ),
        },
  ];
}

function ReviewDialog({ review, onClose }: { review: Review; onClose: () => void }) {
  const [note, setNote] = useState('');
  const approve = review.decision === 'APPROVE';
  return (
    <ConfirmDialog
      title={approve ? 'Duyệt toạ độ đại lý' : 'Từ chối toạ độ đại lý'}
      confirmLabel={approve ? 'Duyệt' : 'Từ chối'}
      tone={approve ? 'primary' : 'danger'}
      successMessage={approve ? 'Đã lưu toạ độ cho đại lý' : 'Đã từ chối đề xuất toạ độ'}
      onClose={onClose}
      onConfirm={() =>
        reviewDealerLocationAction({ id: review.row.id, decision: review.decision, note })
      }
    >
      {approve ? (
        <p>
          Lưu vị trí lúc check-in làm toạ độ của <b>{review.row.dealerName}</b>. Từ lượt check-in
          sau, hệ thống so khoảng cách với toạ độ này và gắn cờ khi quá bán kính trong Tham số.
        </p>
      ) : (
        <p>
          Không dùng vị trí này cho <b>{review.row.dealerName}</b>. Lượt check-in sau tại đại lý sẽ
          tạo đề xuất mới.
        </p>
      )}
      <label className="mt-3 block font-bold" htmlFor="review-note">
        Ghi chú
      </label>
      <textarea
        id="review-note"
        value={note}
        maxLength={500}
        onChange={(event) => setNote(event.target.value)}
        className="mt-1 min-h-20 w-full rounded-md border border-border bg-surface p-2"
      />
    </ConfirmDialog>
  );
}

function getProposalId(row: DealerLocationProposalRow) {
  return row.id;
}

type Props = { data: ListDealerLocationProposalsResult; tab: DealerLocationTab };

export function DealerLocationsTable({ data, tab }: Props) {
  const [review, setReview] = useState<Review | null>(null);
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
            ? 'Không có toạ độ nào chờ duyệt.'
            : 'Chưa có đề xuất toạ độ nào được xử lý.'
        }
      />
      <DataTable.Pagination itemLabel="đề xuất" />
      {review ? <ReviewDialog review={review} onClose={() => setReview(null)} /> : null}
    </DataTable.Root>
  );
}
