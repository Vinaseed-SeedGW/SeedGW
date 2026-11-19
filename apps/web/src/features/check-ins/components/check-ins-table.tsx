'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Image as ImageIcon, MapPin } from 'lucide-react';
import {
  CHECK_IN_FLAG_LABEL,
  CHECK_IN_PLACE_KIND_LABEL,
  checkInPlaceKind,
  formatKm,
  type CheckInRow,
  type ListCheckInsInput,
  type ListCheckInsResult,
} from '@seedgw/contracts/check-ins';
import {
  formatDateTime,
  formatNumber,
  isoDateToDisplay,
  vietnamToday,
} from '@seedgw/contracts/format';
import { DataTable, type ColumnDef } from '@seedgw/ui/data-table';
import { exportCheckInsAction } from '@/server/actions/check-ins';
import { CheckInPhotoDialog } from './check-in-photo-dialog';

const SECONDARY_COLUMN = 'max-md:hidden';
const WRAP_COLUMN = 'min-w-56 whitespace-normal!';

const PLACE_KIND_OPTIONS = checkInPlaceKind.options.map((value) => ({
  value,
  label: CHECK_IN_PLACE_KIND_LABEL[value],
}));

const FLAG_OPTIONS = [{ value: '1', label: 'Chỉ dòng có cờ hoặc km ước tính' }];

function mapsUrl(row: CheckInRow): string {
  return `https://www.google.com/maps/search/?api=1&query=${row.lat},${row.lng}`;
}

/** Mở tab Bản đồ đúng nhân viên và ngày của dòng (V2b). */
function dayMapHref(row: CheckInRow): string {
  const day = isoDateToDisplay(vietnamToday(new Date(row.capturedAt)));
  const params = new URLSearchParams({ tab: 'ban-do', 'nhan-vien': row.employeeCode, ngay: day });
  return `/kinh-doanh/check-in?${params.toString()}`;
}

const ROAD_COLUMN: ColumnDef<CheckInRow> = {
  id: 'roadDistanceKm',
  header: 'Khoảng cách (km)',
  meta: { label: 'Khoảng cách (km)', className: 'text-right' },
  cell: ({ row }) =>
    row.original.roadDistanceKm === null ? (
      <span className="text-text-muted">Đang tính</span>
    ) : (
      <>
        {formatKm(row.original.roadDistanceKm)}
        {row.original.isRoadEstimated ? (
          <span className="block text-sm text-text-muted">ước tính</span>
        ) : null}
      </>
    ),
};

function columns(
  onViewPhoto: (row: CheckInRow) => void,
  roadEnabled: boolean,
): ColumnDef<CheckInRow>[] {
  return [
    {
      id: 'employee',
      header: 'Nhân viên',
      meta: { label: 'Nhân viên' },
      cell: ({ row }) => (
        <>
          {row.original.employeeName}
          <span className="block text-sm text-text-muted">
            {row.original.employeeCode}
            {row.original.orgUnitName ? `, ${row.original.orgUnitName}` : ''}
          </span>
        </>
      ),
    },
    {
      accessorKey: 'capturedAt',
      header: 'Thời gian',
      meta: { label: 'Thời gian' },
      cell: ({ row }) => (
        <>
          {formatDateTime(row.original.capturedAt)}
          <Link href={dayMapHref(row.original)} className="mt-0.5 block w-fit text-sm text-brand">
            Xem hành trình
          </Link>
        </>
      ),
    },
    {
      id: 'place',
      header: 'Nơi check-in',
      meta: { label: 'Nơi check-in', className: WRAP_COLUMN },
      cell: ({ row }) => (
        <>
          {row.original.placeName}
          <span className="block text-sm text-text-muted">
            {CHECK_IN_PLACE_KIND_LABEL[row.original.placeKind]}
          </span>
        </>
      ),
    },
    {
      id: 'address',
      header: 'Địa chỉ',
      meta: { label: 'Địa chỉ', className: `${WRAP_COLUMN} ${SECONDARY_COLUMN}` },
      cell: ({ row }) => (
        <>
          {row.original.address ?? <span className="text-text-muted">Đang lấy địa chỉ</span>}
          <a
            href={mapsUrl(row.original)}
            target="_blank"
            rel="noreferrer"
            className="mt-0.5 flex w-fit items-center gap-1 text-sm text-brand"
          >
            <MapPin size={14} aria-hidden />
            Xem trên bản đồ
            {row.original.accuracyM !== null
              ? `, sai số ${formatNumber(row.original.accuracyM)} m`
              : ''}
          </a>
        </>
      ),
    },
    {
      accessorKey: 'note',
      header: 'Ghi chú',
      meta: { label: 'Ghi chú', className: `${WRAP_COLUMN} ${SECONDARY_COLUMN}` },
      cell: ({ row }) => (
        <>
          {row.original.note}
          {row.original.flags.map((flag) => (
            <span
              key={flag}
              className="mt-1 mr-1 inline-block rounded-sm bg-warning-soft px-1.5 text-sm"
            >
              {CHECK_IN_FLAG_LABEL[flag]}
              {flag === 'FAR_FROM_DEALER' && row.original.dealerDistanceM !== null
                ? `, cách ${formatNumber(row.original.dealerDistanceM)} m`
                : ''}
            </span>
          ))}
          {row.original.farReason ? (
            <span className="block text-sm">Lý do: {row.original.farReason}</span>
          ) : null}
        </>
      ),
    },
    ...(roadEnabled ? [ROAD_COLUMN] : []),
    {
      id: 'gpsDistanceKm',
      header: 'Km theo GPS',
      meta: { label: 'Km theo GPS', className: 'text-right' },
      cell: ({ row }) =>
        row.original.gpsDistanceKm === null ? (
          <span className="text-text-muted">Đang tính</span>
        ) : (
          <>
            {formatKm(row.original.gpsDistanceKm)}
            {row.original.isDistanceEstimated ? (
              <span className="block text-sm text-text-muted">ước tính</span>
            ) : null}
          </>
        ),
    },
    {
      id: 'photo',
      header: 'Ảnh',
      meta: { label: 'Ảnh' },
      cell: ({ row }) =>
        row.original.photoUrl ? (
          <button
            type="button"
            onClick={() => onViewPhoto(row.original)}
            className="inline-flex items-center gap-1 font-bold text-brand"
          >
            <ImageIcon size={16} aria-hidden />
            Xem ảnh
          </button>
        ) : (
          <span className="text-sm text-text-muted">Chưa có hoặc đã hết hạn lưu</span>
        ),
    },
  ];
}

function getCheckInId(row: CheckInRow) {
  return row.id;
}

type Props = { data: ListCheckInsResult; input: ListCheckInsInput };

export function CheckInsTable({ data, input }: Props) {
  const [viewing, setViewing] = useState<CheckInRow | null>(null);
  const filter = {
    from: input.from,
    to: input.to,
    q: input.q,
    placeKind: input.placeKind,
    flaggedOnly: input.flaggedOnly,
  };

  return (
    <DataTable.Root
      columns={columns(setViewing, data.roadEnabled)}
      data={data.items}
      getRowId={getCheckInId}
      total={data.total}
      page={data.page}
      pageSize={data.pageSize}
    >
      <DataTable.Toolbar>
        <DataTable.Search placeholder="Tìm nhân viên theo tên hoặc mã" />
        <DataTable.Filters>
          <DataTable.DateFilter param="tu-ngay" label="Từ ngày" />
          <DataTable.DateFilter param="den-ngay" label="Đến ngày" />
          <DataTable.SelectFilter
            param="loai-diem"
            label="Lọc theo loại điểm"
            allLabel="Tất cả loại điểm"
            options={PLACE_KIND_OPTIONS}
          />
          <DataTable.SelectFilter
            param="co-co"
            label="Lọc dòng có cờ"
            allLabel="Tất cả các dòng"
            options={FLAG_OPTIONS}
          />
        </DataTable.Filters>
        <DataTable.Export action={(ids) => exportCheckInsAction(filter, ids)} />
      </DataTable.Toolbar>
      <DataTable.Body emptyMessage="Không có lượt check-in nào trong khoảng ngày và bộ lọc này." />
      <p className="mt-3 font-bold">
        Tổng {formatNumber(data.total)} lượt check-in,{' '}
        {data.roadEnabled ? `${formatKm(data.totalRoadDistanceKm)} km theo đường đi, ` : ''}
        {formatKm(data.totalGpsDistanceKm)} km theo GPS
      </p>
      <DataTable.Pagination itemLabel="lượt check-in" />
      {viewing ? <CheckInPhotoDialog row={viewing} onClose={() => setViewing(null)} /> : null}
    </DataTable.Root>
  );
}
