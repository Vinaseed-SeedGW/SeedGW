'use client';

import Link from 'next/link';
import { formatDateTime } from '@dms/contracts/format';
import {
  SUPPORT_LEVEL_LABEL,
  SUPPORT_SEVERITY_LABEL,
  SUPPORT_STATUS_LABEL,
  SUPPORT_TYPE_LABEL,
  supportLevel,
  supportLevelSlug,
  supportSeverity,
  supportStatus,
  supportType,
  type SupportListResult,
  type SupportSummary,
} from '@dms/contracts/support';
import { DataTable, type ColumnDef } from '@dms/ui/data-table';
import {
  SupportDueBadge,
  SupportSeverityBadge,
  SupportStatusBadge,
  supportKindText,
} from './support-badges';

const STATUS_OPTIONS = supportStatus.options.map((value) => ({
  value,
  label: SUPPORT_STATUS_LABEL[value],
}));
const TYPE_OPTIONS = supportType.options.map((value) => ({
  value,
  label: SUPPORT_TYPE_LABEL[value],
}));
const SEVERITY_OPTIONS = supportSeverity.options.map((value) => ({
  value,
  label: SUPPORT_SEVERITY_LABEL[value],
}));
const LEVEL_OPTIONS = supportLevel.options.map((value) => ({
  value: supportLevelSlug(value),
  label: SUPPORT_LEVEL_LABEL[value],
}));

const DUE_OPTIONS = [{ value: 'qua-han', label: 'Chỉ yêu cầu quá hạn' }];

const SECONDARY_COLUMN = 'max-md:hidden';

function columns(query: string): ColumnDef<SupportSummary>[] {
  return [
    {
      id: 'title',
      header: 'Yêu cầu',
      meta: { label: 'Yêu cầu', className: 'min-w-60 whitespace-normal!' },
      cell: ({ row }) => (
        <>
          <Link
            href={`/quan-tri/ho-tro/${row.original.code}${query ? `?${query}` : ''}`}
            className="font-bold text-brand hover:underline"
          >
            {row.original.title}
          </Link>
          <span className="block text-sm text-text-muted">
            {row.original.code}, {supportKindText(row.original.type, row.original.severity)}
          </span>
          <span className="mt-1 flex flex-wrap gap-1">
            {row.original.needsReply ? (
              <span className="rounded-sm bg-warning-soft px-1.5 text-sm font-bold">
                Cần trả lời
              </span>
            ) : null}
            {row.original.unread ? (
              <span className="rounded-sm bg-danger px-1.5 text-sm font-bold text-primary-foreground">
                Tin mới
              </span>
            ) : null}
            <SupportSeverityBadge severity={row.original.severity} />
          </span>
        </>
      ),
    },
    {
      id: 'requester',
      header: 'Người gửi',
      meta: { label: 'Người gửi' },
      cell: ({ row }) => (
        <>
          {row.original.requesterName}
          <span className="block text-sm text-text-muted">
            {row.original.requesterCode}
            {row.original.orgUnitName ? `, ${row.original.orgUnitName}` : ''}
          </span>
        </>
      ),
    },
    {
      id: 'status',
      header: 'Trạng thái',
      meta: { label: 'Trạng thái' },
      cell: ({ row }) => (
        <>
          <SupportStatusBadge status={row.original.status} />
          <span className="block text-sm text-text-muted">
            {SUPPORT_LEVEL_LABEL[row.original.level]}
            {row.original.assigneeName ? `, ${row.original.assigneeName}` : ', chưa ai nhận'}
          </span>
        </>
      ),
    },
    {
      id: 'due',
      header: 'Thời hạn',
      meta: { label: 'Thời hạn', className: SECONDARY_COLUMN },
      cell: ({ row }) => <SupportDueBadge due={row.original.due} />,
    },
    {
      id: 'lastActivityAt',
      header: 'Cập nhật',
      meta: { label: 'Cập nhật', className: SECONDARY_COLUMN },
      cell: ({ row }) => formatDateTime(row.original.lastActivityAt),
    },
  ];
}

const getCode = (row: SupportSummary) => row.code;

export function SupportInboxTable({ data, query }: { data: SupportListResult; query: string }) {
  return (
    <DataTable.Root
      columns={columns(query)}
      data={data.items}
      getRowId={getCode}
      total={data.total}
      page={data.page}
      pageSize={data.pageSize}
    >
      <DataTable.Toolbar>
        <DataTable.Search placeholder="Tìm theo mã, tiêu đề, người gửi" />
        <DataTable.Filters>
          <DataTable.SelectFilter
            param="trang-thai"
            label="Lọc theo trạng thái"
            allLabel="Mọi trạng thái"
            options={STATUS_OPTIONS}
          />
          <DataTable.SelectFilter
            param="loai"
            label="Lọc theo loại"
            allLabel="Mọi loại"
            options={TYPE_OPTIONS}
          />
          <DataTable.SelectFilter
            param="muc-do"
            label="Lọc theo mức độ"
            allLabel="Mọi mức độ"
            options={SEVERITY_OPTIONS}
          />
          <DataTable.SelectFilter
            param="cap"
            label="Lọc theo cấp xử lý"
            allLabel="Mọi cấp xử lý"
            options={LEVEL_OPTIONS}
          />
          <DataTable.SelectFilter
            param="han"
            label="Lọc theo thời hạn"
            allLabel="Mọi thời hạn"
            options={DUE_OPTIONS}
          />
        </DataTable.Filters>
      </DataTable.Toolbar>
      <DataTable.Body emptyMessage="Không có yêu cầu hỗ trợ nào khớp bộ lọc này." />
      <DataTable.Pagination itemLabel="yêu cầu" />
    </DataTable.Root>
  );
}
