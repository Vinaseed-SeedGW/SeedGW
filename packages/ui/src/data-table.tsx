'use client';

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type RowData,
  type RowSelectionState,
  type Table,
  type VisibilityState,
} from '@tanstack/react-table';
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  Columns3,
  Download,
  Inbox,
  SlidersHorizontal,
} from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from 'react';
import { cn } from './cn';
import { DateInput } from './date-input';
import { downloadFile } from './download-file';
import { useDismissable } from './use-dismissable';

export type { ColumnDef };

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    label?: string;
    sortKey?: string;
    className?: string;
  }
}

const SEARCH_DEBOUNCE_MS = 300;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const NUMBER_FORMAT = new Intl.NumberFormat('vi-VN');
const CONTROL_CLASS = 'h-9 min-w-0 max-w-full rounded-md border border-input bg-surface px-2.5';
const BUTTON_CLASS =
  'inline-flex h-9 flex-none items-center gap-1.5 rounded-md border border-brand bg-surface px-3 font-bold text-brand hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-50';

type ParamUpdates = Record<string, string | null>;
// Go tim kiem dung replace de nut Quay lai khong phai lui qua tung lan go.
type HistoryMode = 'push' | 'replace';

type DataTableContextValue = {
  state: {
    table: Table<unknown>;
    searchText: string;
    sort: string | null;
    selectedIds: string[];
    isPending: boolean;
    readParam: (name: string) => string | null;
  };
  actions: {
    setParams: (updates: ParamUpdates, history?: HistoryMode) => void;
    clearSelection: () => void;
  };
  meta: {
    total: number;
    page: number;
    pageSize: number;
  };
};

const DataTableContext = createContext<DataTableContextValue | null>(null);

export function useDataTable(): DataTableContextValue {
  const value = use(DataTableContext);
  if (!value) throw new Error('Component nay phai nam trong DataTable.Root.');
  return value;
}

type RootProps<TData> = {
  columns: ColumnDef<TData>[];
  data: TData[];
  getRowId: (row: TData) => string;
  total: number;
  page: number;
  pageSize: number;
  children: ReactNode;
};

function Root<TData>({
  columns,
  data,
  getRowId,
  total,
  page,
  pageSize,
  children,
}: RootProps<TData>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  // Du lieu trang moi thi bo chon cu, dat ngay khi render de khong ve thua mot lan.
  const [previousData, setPreviousData] = useState(data);
  if (previousData !== data) {
    setPreviousData(data);
    setRowSelection({});
  }

  const table = useReactTable({
    columns,
    data,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    state: { rowSelection, columnVisibility },
  });

  const setParams = useCallback(
    (updates: ParamUpdates, history: HistoryMode = 'push') => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [name, value] of Object.entries(updates)) {
        if (value) next.set(name, value);
        else next.delete(name);
      }
      const query = next.toString();
      const href = query ? `${pathname}?${query}` : pathname;
      startTransition(() => {
        router[history](href, { scroll: false });
      });
    },
    [pathname, router, searchParams],
  );

  const clearSelection = useCallback(() => setRowSelection({}), []);

  const value: DataTableContextValue = {
    state: {
      table: table as unknown as Table<unknown>,
      searchText: searchParams.get('q') ?? '',
      sort: searchParams.get('sap-xep'),
      selectedIds: Object.keys(rowSelection),
      isPending,
      readParam: (name) => searchParams.get(name),
    },
    actions: { setParams, clearSelection },
    meta: { total, page, pageSize },
  };

  return <DataTableContext value={value}>{children}</DataTableContext>;
}

function Toolbar({ children }: { children: ReactNode }) {
  return <div className="mt-3.5 flex flex-wrap items-center gap-2">{children}</div>;
}

function Search({ placeholder }: { placeholder: string }) {
  const { state, actions } = useDataTable();
  const [value, setValue] = useState(state.searchText);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastSentRef = useRef(state.searchText);

  // Cap nhat o nhap khi URL doi tu ben ngoai, vi du bam nut quay lai.
  useEffect(() => {
    if (state.searchText !== lastSentRef.current) {
      lastSentRef.current = state.searchText;
      setValue(state.searchText);
    }
  }, [state.searchText]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  function handleChange(next: string) {
    setValue(next);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      lastSentRef.current = next.trim();
      actions.setParams({ q: next.trim() || null, trang: null }, 'replace');
    }, SEARCH_DEBOUNCE_MS);
  }

  return (
    <input
      type="search"
      className={cn(CONTROL_CLASS, 'w-64 max-w-full')}
      placeholder={placeholder}
      aria-label={placeholder}
      value={value}
      onChange={(event) => handleChange(event.target.value)}
    />
  );
}

// Tham số trên URL không phải bộ lọc, không tính vào số bộ lọc đang bật.
const NON_FILTER_PARAMS = new Set(['q', 'trang', 'sap-xep', 'tab']);

/**
 * Bộ lọc của bảng. Dưới 768 px gọn lại sau nút Bộ lọc kèm số bộ lọc đang bật, để danh sách không bị
 * đẩy xuống dưới màn hình đầu; từ 768 px hiện thẳng trên thanh công cụ.
 */
function Filters({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const active = [...searchParams.keys()].filter((key) => !NON_FILTER_PARAMS.has(key)).length;
  return (
    <>
      <button
        type="button"
        className={cn(BUTTON_CLASS, 'md:hidden')}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <SlidersHorizontal size={16} aria-hidden />
        Bộ lọc
        {active > 0 ? (
          <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-brand px-1 text-xs leading-5 text-primary-foreground tabular-nums">
            {active}
          </span>
        ) : null}
      </button>
      <div
        id={panelId}
        className={cn(
          'max-w-full min-w-0 flex-wrap items-center gap-2 max-md:w-full max-md:[&>*]:flex-1 max-md:[&>*]:basis-[calc(50%-4px)]',
          open ? 'flex' : 'hidden md:flex',
        )}
      >
        {children}
      </div>
    </>
  );
}

type SelectFilterProps = {
  param: string;
  label: string;
  allLabel: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  // Tham số khác bỏ đi khi đổi bộ lọc này, ví dụ đổi Vùng thì bỏ Tỉnh.
  resetParams?: readonly string[];
};

function SelectFilter({ param, label, allLabel, options, resetParams = [] }: SelectFilterProps) {
  const { state, actions } = useDataTable();
  return (
    <select
      className={CONTROL_CLASS}
      aria-label={label}
      value={state.readParam(param) ?? ''}
      onChange={(event) =>
        actions.setParams({
          [param]: event.target.value || null,
          trang: null,
          ...Object.fromEntries(resetParams.map((name) => [name, null])),
        })
      }
    >
      <option value="">{allLabel}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function DateFilter({ param, label }: { param: string; label: string }) {
  const { state, actions } = useDataTable();

  function handleChange(next: string) {
    // Chi doi URL khi da go du ngay, neu khong trang tai lai theo tung chu so.
    if (next === '' || ISO_DATE.test(next)) {
      actions.setParams({ [param]: next || null, trang: null });
    }
  }

  return (
    <label className="flex items-center gap-1.5 text-sm">
      {label}
      <DateInput
        className="w-36"
        inputClassName={CONTROL_CLASS}
        value={state.readParam(param) ?? ''}
        onValueChange={handleChange}
      />
    </label>
  );
}

function Columns() {
  const { state } = useDataTable();
  const { open, setOpen, containerRef } = useDismissable();
  const hideable = state.table.getAllLeafColumns().filter((column) => column.getCanHide());

  return (
    <div ref={containerRef} className="relative flex-none">
      <button
        type="button"
        className={BUTTON_CLASS}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((current) => !current)}
      >
        <Columns3 size={16} aria-hidden />
        Cột hiển thị
      </button>
      {open ? (
        <div className="absolute top-full left-0 z-20 mt-1 min-w-48 rounded-md border border-border bg-surface p-1 shadow-md">
          {hideable.map((column) => (
            <label
              key={column.id}
              className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1 hover:bg-brand-soft"
            >
              <input
                type="checkbox"
                className="accent-brand"
                checked={column.getIsVisible()}
                onChange={column.getToggleVisibilityHandler()}
              />
              {column.columnDef.meta?.label ?? column.id}
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}

type ExportResult =
  { ok: true; data: { fileName: string; base64: string } } | { ok: false; message: string };

function Export({ action }: { action: (ids: string[]) => Promise<ExportResult> }) {
  const { state } = useDataTable();
  const [isExporting, startExport] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const selectedCount = state.selectedIds.length;

  function handleClick() {
    setErrorMessage(null);
    startExport(async () => {
      const result = await action(state.selectedIds);
      if (result.ok) downloadFile(result.data);
      else setErrorMessage(result.message);
    });
  }

  return (
    <>
      <button type="button" className={BUTTON_CLASS} disabled={isExporting} onClick={handleClick}>
        <Download size={16} aria-hidden />
        {isExporting
          ? 'Đang xuất...'
          : selectedCount > 0
            ? `Xuất ${NUMBER_FORMAT.format(selectedCount)} dòng đã chọn`
            : 'Xuất Excel'}
      </button>
      {errorMessage ? (
        <p role="alert" className="rounded-md bg-danger-soft px-2.5 py-1.5 text-danger">
          {errorMessage}
        </p>
      ) : null}
    </>
  );
}

function BulkActions({ children }: { children?: ReactNode }) {
  const { state, actions } = useDataTable();
  const selectedCount = state.selectedIds.length;
  if (selectedCount === 0) return null;

  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-3 rounded-md bg-brand-soft px-3 py-1.5">
      <span className="font-bold text-brand">
        Đã chọn {NUMBER_FORMAT.format(selectedCount)} dòng
      </span>
      {children}
      <button type="button" className="text-brand" onClick={actions.clearSelection}>
        Bỏ chọn
      </button>
    </div>
  );
}

function SortHeader({ label, sortKey }: { label: ReactNode; sortKey: string }) {
  const { state, actions } = useDataTable();
  const isAscending = state.sort === sortKey;
  const isDescending = state.sort === `-${sortKey}`;
  const Icon = isAscending ? ArrowUp : isDescending ? ArrowDown : ChevronsUpDown;

  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 font-bold"
      onClick={() =>
        actions.setParams({ 'sap-xep': isAscending ? `-${sortKey}` : sortKey, trang: null })
      }
    >
      {label}
      <Icon size={14} aria-hidden />
    </button>
  );
}

function ariaSort(current: string | null, sortKey: string | undefined) {
  if (!sortKey) return undefined;
  if (current === sortKey) return 'ascending' as const;
  if (current === `-${sortKey}`) return 'descending' as const;
  return 'none' as const;
}

function Body({ emptyMessage }: { emptyMessage: string }) {
  const { state } = useDataTable();
  const { table } = state;
  const rows = table.getRowModel().rows;

  return (
    <div
      className={cn('mt-3 overflow-x-auto transition-opacity', state.isPending && 'opacity-60')}
      aria-busy={state.isPending}
    >
      <table className="w-full border-collapse">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const { meta } = header.column.columnDef;
                const content = flexRender(header.column.columnDef.header, header.getContext());
                return (
                  <th
                    key={header.id}
                    aria-sort={ariaSort(state.sort, meta?.sortKey)}
                    className={cn(
                      'border-b border-border px-2 py-1.5 text-left text-sm font-bold whitespace-nowrap',
                      meta?.className,
                    )}
                  >
                    {meta?.sortKey ? (
                      <SortHeader label={content} sortKey={meta.sortKey} />
                    ) : (
                      content
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {rows.length === 0
            ? null
            : rows.map((row) => (
                <tr key={row.id} className="hover:bg-surface-subtle">
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={cn(
                        'border-b border-surface-subtle px-2 py-2 whitespace-nowrap',
                        cell.column.columnDef.meta?.className,
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
      {/* Câu báo trống nằm ngoài vùng cuộn ngang để luôn đọc được trên điện thoại. */}
      {rows.length === 0 ? (
        <div className="sticky left-0 flex w-full flex-col items-center gap-2 px-2 py-10 text-center text-text-muted">
          <Inbox size={32} aria-hidden />
          <p>{emptyMessage}</p>
        </div>
      ) : null}
    </div>
  );
}

function Pagination({ itemLabel }: { itemLabel: string }) {
  const { state, actions, meta } = useDataTable();
  const lastPage = Math.max(1, Math.ceil(meta.total / meta.pageSize));
  const from = meta.total === 0 ? 0 : (meta.page - 1) * meta.pageSize + 1;
  const to = Math.min(meta.page * meta.pageSize, meta.total);
  const goTo = (page: number) => actions.setParams({ trang: page > 1 ? String(page) : null });
  const canGoBack = meta.page > 1;
  const canGoForward = meta.page < lastPage;

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-text-muted">
      <span>
        Hiển thị {NUMBER_FORMAT.format(from)} - {NUMBER_FORMAT.format(to)} trên{' '}
        {NUMBER_FORMAT.format(meta.total)} {itemLabel}
      </span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="text-brand disabled:text-text-muted"
          disabled={!canGoBack || state.isPending}
          onClick={() => goTo(meta.page - 1)}
        >
          Trang trước
        </button>
        <span>
          Trang {NUMBER_FORMAT.format(meta.page)} / {NUMBER_FORMAT.format(lastPage)}
        </span>
        <button
          type="button"
          className="text-brand disabled:text-text-muted"
          disabled={!canGoForward || state.isPending}
          onClick={() => goTo(meta.page + 1)}
        >
          Trang sau
        </button>
      </div>
    </div>
  );
}

export function selectionColumn<TData>(): ColumnDef<TData> {
  return {
    id: 'select',
    enableHiding: false,
    meta: { className: 'w-9' },
    header: ({ table }) => (
      <input
        type="checkbox"
        className="accent-brand"
        aria-label="Chọn tất cả dòng trong trang"
        checked={table.getIsAllPageRowsSelected()}
        ref={(element) => {
          if (element) element.indeterminate = table.getIsSomePageRowsSelected();
        }}
        onChange={table.getToggleAllPageRowsSelectedHandler()}
      />
    ),
    cell: ({ row }) => (
      <input
        type="checkbox"
        className="accent-brand"
        aria-label="Chọn dòng"
        checked={row.getIsSelected()}
        onChange={row.getToggleSelectedHandler()}
      />
    ),
  };
}

export const DataTable = {
  Root,
  Toolbar,
  Search,
  Filters,
  SelectFilter,
  DateFilter,
  Columns,
  Export,
  BulkActions,
  Body,
  Pagination,
};
