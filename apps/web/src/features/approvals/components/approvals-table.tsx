'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  APPROVAL_KIND_LABEL,
  type ApprovalRow,
  type ApprovalTab,
  type ListApprovalsResult,
} from '@dms/contracts/approvals';
import { formatDateTime } from '@dms/contracts/format';
import { ConfirmDialog } from '@dms/ui/confirm-dialog';
import { DataTable, selectionColumn, useDataTable, type ColumnDef } from '@dms/ui/data-table';
import { bulkApproveAction } from '@/server/actions/approvals';
import { ApprovalStatusBadge } from './approval-status-badge';

const SECONDARY_COLUMN = 'max-md:hidden';
const WRAP_COLUMN = 'min-w-56 whitespace-normal!';

const KIND_OPTIONS = Object.entries(APPROVAL_KIND_LABEL).map(([value, label]) => ({
  value,
  label,
}));

function columns(tab: ApprovalTab): ColumnDef<ApprovalRow>[] {
  const list: ColumnDef<ApprovalRow>[] = [
    {
      accessorKey: 'code',
      header: 'Phiếu',
      meta: { label: 'Phiếu' },
      cell: ({ row }) => (
        <>
          <Link
            href={`/kinh-doanh/can-duyet/${row.original.code}`}
            className="font-bold text-brand hover:underline"
          >
            {row.original.code}
          </Link>
          <span className="block text-sm text-text-muted">
            {APPROVAL_KIND_LABEL[row.original.kind]}
          </span>
        </>
      ),
    },
    {
      accessorKey: 'submittedByName',
      header: 'Người gửi',
      meta: { label: 'Người gửi' },
      cell: ({ row }) => (
        <>
          {row.original.submittedByName}
          <span className="block text-sm text-text-muted">
            {row.original.submittedByCode}
            {row.original.orgUnitName ? `, ${row.original.orgUnitName}` : ''}
          </span>
        </>
      ),
    },
    {
      id: 'content',
      header: 'Nội dung',
      meta: { label: 'Nội dung', className: WRAP_COLUMN },
      cell: ({ row }) => (
        <>
          <span className="font-bold">{row.original.periodLabel}</span>
          <span className="block text-sm">{row.original.summaryText}</span>
        </>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Trạng thái',
      meta: { label: 'Trạng thái' },
      cell: ({ row }) => (
        <>
          <ApprovalStatusBadge status={row.original.status} />
          {row.original.currentApproverName ? (
            <span className="block text-sm text-text-muted">
              Người duyệt: {row.original.currentApproverName}
            </span>
          ) : null}
        </>
      ),
    },
    {
      accessorKey: 'submittedAt',
      header: 'Gửi lúc',
      meta: { label: 'Gửi lúc', className: SECONDARY_COLUMN },
      cell: ({ row }) => (
        <>
          {row.original.submittedAt ? formatDateTime(row.original.submittedAt) : ''}
          <span className="block text-sm text-text-muted">
            {row.original.submissionCount > 1 ? `Gửi lần ${row.original.submissionCount}` : ''}
            {row.original.isLate ? (
              <span className="ml-1 rounded-sm bg-warning-soft px-1.5 text-text">Nộp muộn</span>
            ) : null}
          </span>
        </>
      ),
    },
  ];
  return tab === 'cho-toi-duyet' ? [selectionColumn<ApprovalRow>(), ...list] : list;
}

function getCode(row: ApprovalRow) {
  return row.code;
}

function BulkApprove() {
  const { state } = useDataTable();
  const [open, setOpen] = useState(false);
  const codes = state.selectedIds;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 items-center rounded-md bg-brand px-3 font-bold text-primary-foreground hover:bg-brand-hover"
      >
        Duyệt các phiếu đã chọn
      </button>
      {open ? (
        <ConfirmDialog
          title="Duyệt nhiều phiếu"
          confirmLabel={`Duyệt ${codes.length} phiếu`}
          tone="primary"
          successMessage={`Đã duyệt ${codes.length} phiếu`}
          onClose={() => setOpen(false)}
          onConfirm={async () => {
            const result = await bulkApproveAction({ codes });
            if (!result.ok) return result;
            if (result.data.failed.length === 0) return { ok: true };
            return {
              ok: false,
              message: `Đã duyệt ${result.data.approved} phiếu. Chưa duyệt được: ${result.data.failed
                .map((item) => `${item.code} (${item.message})`)
                .join('; ')}`,
            };
          }}
        >
          <p>
            Duyệt {codes.length} phiếu đã chọn, không kèm ghi chú. Phiếu đang ở bước Quản lý sẽ
            chuyển lên Lãnh đạo đơn vị.
          </p>
        </ConfirmDialog>
      ) : null}
    </>
  );
}

type Props = {
  data: ListApprovalsResult;
  tab: ApprovalTab;
  orgUnits: ReadonlyArray<{ value: string; label: string }>;
};

const EMPTY_MESSAGE: Record<ApprovalTab, string> = {
  'cho-toi-duyet': 'Không có phiếu nào chờ bạn duyệt.',
  'da-xu-ly': 'Bạn chưa duyệt hoặc trả lại phiếu nào.',
  'tat-ca': 'Chưa có phiếu nào trong phạm vi của bạn.',
};

export function ApprovalsTable({ data, tab, orgUnits }: Props) {
  return (
    <DataTable.Root
      columns={columns(tab)}
      data={data.items}
      getRowId={getCode}
      total={data.total}
      page={data.page}
      pageSize={data.pageSize}
    >
      <DataTable.Toolbar>
        <DataTable.Search placeholder="Tìm mã phiếu, tên hoặc mã nhân viên" />
        <DataTable.Filters>
          <DataTable.SelectFilter
            param="loai"
            label="Loại phiếu"
            allLabel="Tất cả loại phiếu"
            options={KIND_OPTIONS}
          />
          {orgUnits.length > 1 ? (
            <DataTable.SelectFilter
              param="don-vi"
              label="Đơn vị"
              allLabel="Tất cả đơn vị"
              options={orgUnits}
            />
          ) : null}
        </DataTable.Filters>
      </DataTable.Toolbar>
      {tab === 'cho-toi-duyet' ? (
        <DataTable.BulkActions>
          <BulkApprove />
        </DataTable.BulkActions>
      ) : null}
      <DataTable.Body emptyMessage={EMPTY_MESSAGE[tab]} />
      <DataTable.Pagination itemLabel="phiếu" />
    </DataTable.Root>
  );
}
