'use client';

import { useState, type ReactNode } from 'react';
import { Image as ImageIcon, MapPin } from 'lucide-react';
import {
  DEALER_PROPOSAL_STATUS_LABEL,
  type DealerProposalOptions,
  type DealerProposalRow,
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

function ResultCell({ row, dealerBasePath }: { row: DealerProposalRow; dealerBasePath: string }) {
  if (row.status === 'PENDING') {
    return (
      <>
        <span className="font-bold">{DEALER_PROPOSAL_STATUS_LABEL.PENDING}</span>
        <span className="block text-sm text-text-muted">
          {row.currentApproverName
            ? `Người duyệt: ${row.currentApproverName}`
            : 'Chưa có người duyệt, Quản trị hệ thống duyệt thay'}
        </span>
      </>
    );
  }
  return (
    <>
      <span className="font-bold">{DEALER_PROPOSAL_STATUS_LABEL[row.status]}</span>
      {row.dealer ? (
        <a href={`${dealerBasePath}/${row.dealer.id}`} className="block text-sm text-brand">
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

const BASE_COLUMNS: ColumnDef<DealerProposalRow>[] = [
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

// Kết quả đứng ngay sau tên để trên điện thoại không phải kéo ngang mới thấy.
function resultColumns(dealerBasePath: string): ColumnDef<DealerProposalRow>[] {
  const [name, ...rest] = BASE_COLUMNS;
  return [
    ...(name ? [name] : []),
    {
      accessorKey: 'status',
      header: 'Kết quả',
      meta: { label: 'Kết quả', className: WRAP_COLUMN },
      cell: ({ row }) => <ResultCell row={row.original} dealerBasePath={dealerBasePath} />,
    },
    ...rest,
  ];
}

function reviewColumns(onReview: (review: Review) => void): ColumnDef<DealerProposalRow>[] {
  return [
    ...BASE_COLUMNS,
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

type TableFrameProps = {
  data: ListDealerProposalsResult;
  columns: ColumnDef<DealerProposalRow>[];
  emptyMessage: string;
  toolbar?: ReactNode;
  children?: ReactNode;
};

function TableFrame({ data, columns, emptyMessage, toolbar, children }: TableFrameProps) {
  return (
    <DataTable.Root
      columns={columns}
      data={data.items}
      getRowId={getProposalId}
      total={data.total}
      page={data.page}
      pageSize={data.pageSize}
    >
      {toolbar}
      <DataTable.Body emptyMessage={emptyMessage} />
      <DataTable.Pagination itemLabel="đề xuất" />
      {children}
    </DataTable.Root>
  );
}

type ReviewTableProps = {
  data: ListDealerProposalsResult;
  options: DealerProposalOptions;
  /** Đơn vị được chọn khi duyệt một dòng. */
  unitsFor: (row: DealerProposalRow) => DealerProposalOptions['orgUnits'];
};

function ReviewTable({ data, options, unitsFor }: ReviewTableProps) {
  const [review, setReview] = useState<Review | null>(null);
  const close = () => setReview(null);
  return (
    <TableFrame
      data={data}
      columns={reviewColumns(setReview)}
      emptyMessage="Không có đề xuất đại lý mới nào chờ duyệt."
    >
      {review?.kind === 'approve' ? (
        <ApproveProposalSheet
          row={review.row}
          options={{ ...options, orgUnits: unitsFor(review.row) }}
          onClose={close}
        />
      ) : null}
      {review?.kind === 'reject' ? <RejectProposalDialog row={review.row} onClose={close} /> : null}
      {review?.kind === 'duplicate' ? (
        <DuplicateProposalDialog row={review.row} onClose={close} />
      ) : null}
    </TableFrame>
  );
}

/** Quản lý, Lãnh đạo đơn vị duyệt ở Cần duyệt: đại lý thuộc đơn vị của người đề xuất. */
export function DealerProposalsApproverTable({
  data,
  options,
}: Omit<ReviewTableProps, 'unitsFor'>) {
  return (
    <ReviewTable
      data={data}
      options={options}
      unitsFor={(row) => options.orgUnits.filter((unit) => unit.value === row.orgUnitId)}
    />
  );
}

/** Quản trị hệ thống duyệt thay ở Quản trị › Đại lý mới, chọn được đơn vị phụ trách. */
export function DealerProposalsOverrideTable({
  data,
  options,
}: Omit<ReviewTableProps, 'unitsFor'>) {
  return <ReviewTable data={data} options={options} unitsFor={() => options.orgUnits} />;
}

type ResultTableProps = {
  data: ListDealerProposalsResult;
  dealerBasePath: string;
  emptyMessage: string;
  toolbar?: ReactNode;
};

/** Chỉ xem: trạng thái, người duyệt, kết quả. */
export function DealerProposalsResultTable({
  data,
  dealerBasePath,
  emptyMessage,
  toolbar,
}: ResultTableProps) {
  return (
    <TableFrame
      data={data}
      columns={resultColumns(dealerBasePath)}
      emptyMessage={emptyMessage}
      toolbar={toolbar}
    />
  );
}

const STATUS_FILTER_OPTIONS = [
  { value: 'cho-duyet', label: 'Chờ duyệt' },
  { value: 'da-duyet', label: 'Đã duyệt' },
  { value: 'trung', label: 'Trùng đại lý có sẵn' },
  { value: 'tu-choi', label: 'Từ chối' },
];

/** Trang Đại lý đề xuất ở Kinh doanh: tìm, lọc trạng thái và ngày chụp. */
export function DealerProposalsInScopeTable({
  data,
  emptyMessage,
}: {
  data: ListDealerProposalsResult;
  emptyMessage: string;
}) {
  return (
    <DealerProposalsResultTable
      data={data}
      dealerBasePath="/kinh-doanh/dai-ly"
      emptyMessage={emptyMessage}
      toolbar={
        <DataTable.Toolbar>
          <DataTable.Search placeholder="Tìm theo tên, số điện thoại, địa chỉ" />
          <DataTable.Filters>
            <DataTable.SelectFilter
              param="trang-thai"
              label="Lọc theo trạng thái"
              allLabel="Mọi trạng thái"
              options={STATUS_FILTER_OPTIONS}
            />
            <DataTable.DateFilter param="tu-ngay" label="Từ ngày" />
            <DataTable.DateFilter param="den-ngay" label="Đến ngày" />
          </DataTable.Filters>
        </DataTable.Toolbar>
      }
    />
  );
}
