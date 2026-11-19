'use client';

import { useState, useTransition } from 'react';
import {
  PHONE_ISSUE_LABEL,
  type BadPhoneRow,
  type BadPhonesResult,
  type PhoneIssueKind,
} from '@seedgw/contracts/dealer-cleanup';
import { formatNumber } from '@seedgw/contracts/format';
import { ConfirmDialog } from '@seedgw/ui/confirm-dialog';
import { DataTable, type ColumnDef } from '@seedgw/ui/data-table';
import { useToast } from '@seedgw/ui/toast';
import { clearDealerPhonesAction, fixDealerPhoneAction } from '@/server/actions/dealer-cleanup';

const SMALL =
  'inline-flex h-8 items-center rounded-md border border-border bg-surface px-2 text-sm font-bold text-brand hover:bg-brand-soft disabled:opacity-50';

/** Một dòng: ô sửa số, Lưu, hoặc Bỏ số này (để trống điện thoại). */
function PhoneFixer({ row }: { row: BadPhoneRow }) {
  const { actions: toast } = useToast();
  const [value, setValue] = useState(row.kind === 'JUNK' ? '' : row.phoneRaw);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await fixDealerPhoneAction({ id: row.id, phone: value });
      if (result.ok) {
        toast.show({ tone: 'success', message: `Đã sửa số của ${row.name}` });
        setError(null);
      } else {
        setError(result.fieldErrors?.phone ?? result.message);
      }
    });
  }

  function clear() {
    startTransition(async () => {
      const result = await clearDealerPhonesAction({ ids: [row.id] });
      if (result.ok) toast.show({ tone: 'success', message: `Đã bỏ số sai của ${row.name}` });
      else setError(result.message);
    });
  }

  return (
    <div className="grid gap-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          inputMode="tel"
          aria-label={`Số điện thoại mới của ${row.name}`}
          aria-invalid={error !== null}
          className="h-8 w-36 rounded-md border border-input bg-surface px-2"
        />
        <button type="button" className={SMALL} disabled={isPending || !value} onClick={save}>
          Lưu
        </button>
        <button type="button" className={SMALL} disabled={isPending} onClick={clear}>
          Bỏ số này
        </button>
      </div>
      {error ? <span className="text-sm text-danger">{error}</span> : null}
    </div>
  );
}

const COLUMNS: ColumnDef<BadPhoneRow>[] = [
  {
    accessorKey: 'name',
    header: 'Đại lý',
    meta: { label: 'Đại lý', className: 'min-w-56 whitespace-normal!' },
    cell: ({ row }) => (
      <>
        <span className="font-bold">{row.original.name}</span>
        <span className="block text-sm text-text-muted">
          {row.original.code ? `${row.original.code}, ` : ''}
          {row.original.address}
        </span>
      </>
    ),
  },
  {
    accessorKey: 'phoneRaw',
    header: 'Số đang ghi',
    meta: { label: 'Số đang ghi' },
    cell: ({ row }) => (
      <>
        <span className="font-bold">{row.original.phoneRaw || '(trống)'}</span>
        <span className="block text-sm text-text-muted">
          {PHONE_ISSUE_LABEL[row.original.kind]}
        </span>
      </>
    ),
  },
  {
    id: 'owner',
    header: 'Phụ trách',
    meta: { label: 'Phụ trách', className: 'max-md:hidden' },
    cell: ({ row }) => (
      <>
        {row.original.assignedUserName ?? 'Chưa gán'}
        <span className="block text-sm text-text-muted">{row.original.orgUnitName ?? ''}</span>
      </>
    ),
  },
  {
    id: 'fix',
    header: 'Sửa',
    meta: { label: 'Sửa' },
    cell: ({ row }) => <PhoneFixer key={row.original.id} row={row.original} />,
  },
];

function getId(row: BadPhoneRow) {
  return row.id;
}

/** Nút bỏ hàng loạt số rác (0, 1, trống) trong phạm vi, có hỏi lại trước khi làm. */
function ClearJunk({ count }: { count: number }) {
  const [open, setOpen] = useState(false);
  if (count === 0) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center rounded-md bg-brand px-3 font-bold text-primary-foreground hover:bg-brand-hover"
      >
        Bỏ tất cả {formatNumber(count)} số rác
      </button>
      {open ? (
        <ConfirmDialog
          title="Bỏ số rác"
          confirmLabel="Bỏ số rác"
          tone="danger"
          successMessage="Đã bỏ số rác"
          onClose={() => setOpen(false)}
          onConfirm={async () => {
            const result = await clearDealerPhonesAction({ kind: 'JUNK' });
            return result.ok ? { ok: true } : result;
          }}
        >
          <p>
            {formatNumber(count)} đại lý đang ghi số điện thoại là 0, 1 hoặc trống. Các đại lý này
            sẽ để trống điện thoại, chờ người phụ trách cập nhật số thật. Mỗi đại lý đều ghi nhật
            ký.
          </p>
        </ConfirmDialog>
      ) : null}
    </>
  );
}

export function BadPhonesTable({
  data,
  kind,
}: {
  data: BadPhonesResult;
  kind: PhoneIssueKind | undefined;
}) {
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
        <DataTable.Search placeholder="Tìm tên, mã đại lý hoặc số đang ghi" />
        {kind === 'JUNK' ? <ClearJunk count={data.counts.JUNK ?? 0} /> : null}
      </DataTable.Toolbar>
      <DataTable.Body emptyMessage="Không còn số điện thoại sai dạng trong nhóm này." />
      <DataTable.Pagination itemLabel="đại lý" />
    </DataTable.Root>
  );
}
