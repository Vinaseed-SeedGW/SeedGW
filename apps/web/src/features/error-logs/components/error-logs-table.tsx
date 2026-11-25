'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import {
  ERROR_SOURCE_LABEL,
  ERROR_SOURCE_OPTIONS,
  type ErrorLogRow,
  type ListErrorLogsResult,
} from '@seedgw/contracts/error-logs';
import { formatDateTime, formatNumber } from '@seedgw/contracts/format';
import { DataTable, type ColumnDef } from '@seedgw/ui/data-table';
import { useToast } from '@seedgw/ui/toast';
import { resolveErrorLogsAction } from '@/server/actions/error-logs';

const STATUS_OPTIONS = [{ value: 'da-xu-ly', label: 'Đã xử lý' }];

function ResolveButton({ id }: { id: string }) {
  const router = useRouter();
  const { actions: toast } = useToast();
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await resolveErrorLogsAction({ ids: [id] });
          if (!result.ok) toast.show({ tone: 'error', message: result.message });
          else toast.show({ tone: 'success', message: 'Đã đánh dấu đã xử lý' });
          router.refresh();
        })
      }
      className="inline-flex h-9 items-center rounded-md border border-brand bg-surface px-3 font-bold text-brand hover:bg-brand-soft disabled:opacity-60"
    >
      Đã xử lý
    </button>
  );
}

const COLUMNS: ColumnDef<ErrorLogRow>[] = [
  {
    id: 'lastSeenAt',
    header: 'Lần gần nhất',
    meta: { label: 'Lần gần nhất' },
    cell: ({ row }) => (
      <span className="tabular-nums">
        {formatDateTime(row.original.lastSeenAt)}
        <span className="block text-sm text-text-muted">
          {formatNumber(row.original.count)} lần, từ {formatDateTime(row.original.firstSeenAt)}
        </span>
      </span>
    ),
  },
  {
    id: 'source',
    header: 'Nguồn',
    meta: { label: 'Nguồn' },
    cell: ({ row }) => (
      <>
        {ERROR_SOURCE_LABEL[row.original.source]}
        {row.original.appVersion ? (
          <span className="block text-sm text-text-muted">{row.original.appVersion}</span>
        ) : null}
      </>
    ),
  },
  {
    id: 'message',
    header: 'Nội dung lỗi',
    meta: { label: 'Nội dung lỗi', className: 'min-w-80 whitespace-normal!' },
    cell: ({ row }) => (
      <div className="max-w-xl">
        <p className="font-bold break-words">{row.original.message}</p>
        {row.original.path ? (
          <p className="text-sm break-all text-text-muted">{row.original.path}</p>
        ) : null}
        {row.original.userName ? (
          <p className="text-sm text-text-muted">Gần nhất: {row.original.userName}</p>
        ) : null}
        {row.original.stack ? (
          <details className="mt-1 text-sm">
            <summary className="cursor-pointer text-brand">Xem ngăn xếp lỗi</summary>
            <pre className="mt-1 max-h-60 overflow-auto rounded-md bg-surface-subtle p-2 text-xs whitespace-pre-wrap">
              {row.original.stack}
            </pre>
          </details>
        ) : null}
      </div>
    ),
  },
  {
    id: 'actions',
    header: '',
    meta: { label: 'Thao tác' },
    cell: ({ row }) =>
      row.original.resolvedAt ? (
        <span className="text-sm text-text-muted">
          Xử lý lúc {formatDateTime(row.original.resolvedAt)}
        </span>
      ) : (
        <ResolveButton id={row.original.id} />
      ),
  },
];

function getId(row: ErrorLogRow) {
  return row.id;
}

export function ErrorLogsTable({ data }: { data: ListErrorLogsResult }) {
  return (
    <DataTable.Root
      columns={COLUMNS}
      data={data.items}
      getRowId={getId}
      total={data.total}
      page={data.page}
      pageSize={data.pageSize}
    >
      <DataTable.Toolbar>
        <DataTable.Filters>
          <DataTable.SelectFilter
            param="nguon"
            label="Lọc theo nguồn lỗi"
            allLabel="Mọi nguồn"
            options={ERROR_SOURCE_OPTIONS}
          />
          <DataTable.SelectFilter
            param="trang-thai"
            label="Lọc theo trạng thái"
            allLabel="Chưa xử lý"
            options={STATUS_OPTIONS}
          />
        </DataTable.Filters>
      </DataTable.Toolbar>
      <DataTable.Body emptyMessage="Không có lỗi nào. Lỗi mới của web, app, worker sẽ hiện ở đây." />
      <DataTable.Pagination itemLabel="lỗi" />
    </DataTable.Root>
  );
}
