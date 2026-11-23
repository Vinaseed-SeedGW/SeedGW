'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRef, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { formatNumber } from '@seedgw/contracts/format';
import { formatMonthLabel, targetPercent } from '@seedgw/contracts/sales-targets';
import {
  assignTargetInput,
  type AssignmentRow,
  type AssignmentsResult,
  type TargetImportResult,
} from '@seedgw/contracts/target-assignments';
import { ConfirmDialog } from '@seedgw/ui/confirm-dialog';
import { DataTable, type ColumnDef } from '@seedgw/ui/data-table';
import { downloadFile } from '@seedgw/ui/download-file';
import { Form } from '@seedgw/ui/form';
import { FormSheet } from '@seedgw/ui/form-sheet';
import { useToast } from '@seedgw/ui/toast';
import {
  assignTargetAction,
  downloadAssignmentTemplateAction,
  importAssignmentsAction,
  removeTargetAction,
} from '@/server/actions/target-assignments';

// Tab Giao chỉ tiêu (K3): đơn vị và nhân viên trong phạm vi, chỉ tiêu tháng đã giao và kết quả thực tế.

type FormValues = z.input<typeof assignTargetInput>;
type Editing = { row: AssignmentRow; kind: 'assign' | 'remove' };

const SECONDARY_COLUMN = 'max-md:hidden';
const BUTTON =
  'inline-flex h-9.5 items-center rounded-md border border-border bg-surface px-3 font-bold hover:bg-brand-soft';

function progressText(actual: number, target: number | null): string {
  const percent = targetPercent(actual, target);
  if (target === null) return formatNumber(actual);
  return `${formatNumber(actual)} / ${formatNumber(target)}${percent !== null ? `, ${percent}%` : ''}`;
}

function columns(
  editable: boolean,
  onEdit: (editing: Editing) => void,
): ColumnDef<AssignmentRow>[] {
  return [
    {
      accessorKey: 'name',
      header: 'Tên',
      meta: { label: 'Tên', className: 'min-w-48 whitespace-normal!' },
      cell: ({ row }) => (
        <>
          <span className="font-bold">{row.original.name}</span>
          <span className="block text-sm text-text-muted">
            {row.original.code}
            {row.original.orgUnitName ? `, ${row.original.orgUnitName}` : ''}
          </span>
        </>
      ),
    },
    {
      id: 'target',
      header: 'Chỉ tiêu tháng',
      meta: { label: 'Chỉ tiêu tháng', className: 'min-w-48 whitespace-normal!' },
      cell: ({ row }) => {
        const { assignment, selfTarget } = row.original;
        if (assignment) {
          return (
            <>
              {formatNumber(assignment.visitCountTarget)} lượt,{' '}
              {formatNumber(assignment.dealerCoverageTarget)} đại lý
              <span className="block text-sm text-text-muted">
                Giao bởi {assignment.assignedByName}
                {assignment.note ? `. ${assignment.note}` : ''}
              </span>
            </>
          );
        }
        if (selfTarget) {
          return (
            <>
              {formatNumber(selfTarget.visitCountTarget)} lượt,{' '}
              {formatNumber(selfTarget.dealerCoverageTarget)} đại lý
              <span className="block text-sm text-text-muted">Tự đăng ký, đã duyệt</span>
            </>
          );
        }
        return <span className="text-text-muted">Chưa giao</span>;
      },
    },
    {
      id: 'visits',
      header: 'Lượt ghé thăm',
      meta: { label: 'Lượt ghé thăm', className: SECONDARY_COLUMN },
      cell: ({ row }) =>
        progressText(
          row.original.progress.visitCount,
          row.original.assignment?.visitCountTarget ??
            row.original.selfTarget?.visitCountTarget ??
            null,
        ),
    },
    {
      id: 'dealers',
      header: 'Đại lý được ghé',
      meta: { label: 'Đại lý được ghé', className: SECONDARY_COLUMN },
      cell: ({ row }) =>
        progressText(
          row.original.progress.dealerCoverage,
          row.original.assignment?.dealerCoverageTarget ??
            row.original.selfTarget?.dealerCoverageTarget ??
            null,
        ),
    },
    ...(editable
      ? [
          {
            id: 'actions',
            header: 'Xử lý',
            meta: { label: 'Xử lý' },
            cell: ({ row }) => (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={BUTTON}
                  onClick={() => onEdit({ row: row.original, kind: 'assign' })}
                >
                  {row.original.assignment ? 'Sửa' : 'Giao'}
                </button>
                {row.original.assignment ? (
                  <button
                    type="button"
                    className={BUTTON}
                    onClick={() => onEdit({ row: row.original, kind: 'remove' })}
                  >
                    Bỏ
                  </button>
                ) : null}
              </div>
            ),
          } satisfies ColumnDef<AssignmentRow>,
        ]
      : []),
  ];
}

function AssignSheet({
  month,
  row,
  onClose,
}: {
  month: string;
  row: AssignmentRow;
  onClose: () => void;
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(assignTargetInput),
    defaultValues: {
      month,
      kind: row.kind,
      assigneeId: row.assigneeId,
      visitCountTarget: row.assignment?.visitCountTarget ?? row.selfTarget?.visitCountTarget ?? 0,
      dealerCoverageTarget:
        row.assignment?.dealerCoverageTarget ?? row.selfTarget?.dealerCoverageTarget ?? 0,
      note: row.assignment?.note ?? '',
    },
  });
  return (
    <FormSheet.Root title={`Giao chỉ tiêu ${formatMonthLabel(month)}`} onClose={onClose}>
      <p className="mb-3">
        <b>{row.name}</b>
        <span className="block text-sm text-text-muted">
          {row.kind === 'UNIT'
            ? 'Chỉ tiêu của cả đơn vị, gồm các đơn vị con.'
            : 'Chỉ tiêu được giao thay chỉ tiêu nhân viên tự đăng ký của tháng này.'}
        </span>
      </p>
      <Form.Root
        form={form}
        action={assignTargetAction}
        successMessage="Đã giao chỉ tiêu"
        onSuccess={onClose}
      >
        <Form.Field name="visitCountTarget" label="Lượt ghé thăm trong tháng">
          <Form.Input type="number" inputMode="numeric" min={0} step={1} />
        </Form.Field>
        <Form.Field name="dealerCoverageTarget" label="Số đại lý được ghé">
          <Form.Input type="number" inputMode="numeric" min={0} step={1} />
        </Form.Field>
        <Form.Field name="note" label="Ghi chú (không bắt buộc)">
          <Form.Input maxLength={500} />
        </Form.Field>
        <Form.Error />
        <Form.Actions>
          <Form.Submit>Lưu</Form.Submit>
          <FormSheet.Close>Huỷ</FormSheet.Close>
        </Form.Actions>
      </Form.Root>
    </FormSheet.Root>
  );
}

function RemoveDialog({
  row,
  month,
  onClose,
}: {
  row: AssignmentRow;
  month: string;
  onClose: () => void;
}) {
  return (
    <ConfirmDialog
      title="Bỏ chỉ tiêu được giao"
      confirmLabel="Bỏ chỉ tiêu"
      tone="danger"
      successMessage="Đã bỏ chỉ tiêu được giao"
      onClose={onClose}
      onConfirm={() => removeTargetAction({ id: row.assignment?.id ?? '' })}
    >
      <p>
        Bỏ chỉ tiêu {formatMonthLabel(month)} đã giao cho <b>{row.name}</b>.
        {row.kind === 'USER'
          ? ' Nhân viên dùng lại chỉ tiêu tự đăng ký nếu có.'
          : ' Đơn vị dùng tổng chỉ tiêu của nhân viên.'}
      </p>
    </ConfirmDialog>
  );
}

function ExcelTools({ month }: { month: string }) {
  const { actions: toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<TargetImportResult | null>(null);
  const input = useRef<HTMLInputElement>(null);

  function download() {
    startTransition(async () => {
      const response = await downloadAssignmentTemplateAction(month);
      if (response.ok) downloadFile(response.data);
      else toast.show({ tone: 'error', message: response.message });
    });
  }

  function upload(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    startTransition(async () => {
      const response = await importAssignmentsAction(formData);
      if (input.current) input.current.value = '';
      if (!response.ok) {
        toast.show({ tone: 'error', message: response.message });
        return;
      }
      setResult(response.data);
      if (response.data.errors.length === 0) {
        toast.show({ tone: 'success', message: `Đã giao ${response.data.applied} chỉ tiêu` });
      }
    });
  }

  return (
    <div className="mt-4 rounded-md border border-border bg-surface p-4">
      <h2 className="font-bold">Nhập từ Excel</h2>
      <p className="mt-1 text-sm text-text-muted">
        Tải file mẫu đã điền sẵn đơn vị, nhân viên trong phạm vi và chỉ tiêu đang giao, sửa số rồi
        tải lên. Dòng để trống hai ô chỉ tiêu được bỏ qua. Có dòng lỗi thì không ghi dòng nào.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" className={BUTTON} onClick={download} disabled={isPending}>
          Tải file mẫu {formatMonthLabel(month)}
        </button>
        <label className={`${BUTTON} cursor-pointer`}>
          Tải file lên
          <input
            ref={input}
            type="file"
            accept=".xlsx"
            className="sr-only"
            disabled={isPending}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) upload(file);
            }}
          />
        </label>
        {isPending ? <span className="text-sm text-text-muted">Đang xử lý</span> : null}
      </div>
      {result && result.errors.length > 0 ? (
        <div role="alert" className="mt-3 rounded-md bg-danger-soft p-3">
          <p className="font-bold text-danger">
            Có {result.errors.length} dòng lỗi, chưa ghi dòng nào. Sửa file rồi tải lên lại.
          </p>
          <ul className="mt-1 list-disc pl-5 text-sm">
            {result.errors.slice(0, 50).map((error) => (
              <li key={`${error.row}-${error.message}`}>
                Dòng {error.row}: {error.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function getId(row: AssignmentRow) {
  return `${row.kind}-${row.assigneeId}`;
}

function Section({
  title,
  rows,
  editable,
  onEdit,
  emptyMessage,
}: {
  title: string;
  rows: AssignmentRow[];
  editable: boolean;
  onEdit: (editing: Editing) => void;
  emptyMessage: string;
}) {
  return (
    <section className="mt-6">
      <h2 className="text-lg font-bold text-brand">{title}</h2>
      <DataTable.Root
        columns={columns(editable, onEdit)}
        data={rows}
        getRowId={getId}
        total={rows.length}
        page={1}
        pageSize={Math.max(rows.length, 1)}
      >
        <DataTable.Body emptyMessage={emptyMessage} />
      </DataTable.Root>
    </section>
  );
}

export function TargetAssignments({
  data,
  months,
  editable,
}: {
  data: AssignmentsResult;
  months: { value: string; label: string }[];
  editable: boolean;
}) {
  const [editing, setEditing] = useState<Editing | null>(null);
  const close = () => setEditing(null);
  return (
    <>
      <nav aria-label="Tháng" className="mt-4 flex flex-wrap gap-2">
        {months.map((month) => (
          <Link
            key={month.value}
            href={`/kinh-doanh/chi-tieu?tab=giao&thang=${month.value}`}
            aria-current={month.value === data.month ? 'page' : undefined}
            className={`rounded-md border px-3 py-1.5 ${month.value === data.month ? 'border-brand bg-brand-soft font-bold text-brand' : 'border-border hover:bg-brand-soft'}`}
          >
            {month.label}
          </Link>
        ))}
      </nav>
      {editable ? null : (
        <p className="mt-3 text-sm text-text-muted">
          Tháng đã qua chỉ xem, không giao hoặc sửa được.
        </p>
      )}
      {editable ? <ExcelTools month={data.month} /> : null}
      <Section
        title="Đơn vị"
        rows={data.units}
        editable={editable}
        onEdit={setEditing}
        emptyMessage="Không có đơn vị nào trong phạm vi."
      />
      <Section
        title="Nhân viên"
        rows={data.users}
        editable={editable}
        onEdit={setEditing}
        emptyMessage="Không có nhân viên nào trong phạm vi."
      />
      {editing?.kind === 'assign' ? (
        <AssignSheet month={data.month} row={editing.row} onClose={close} />
      ) : null}
      {editing?.kind === 'remove' ? (
        <RemoveDialog month={data.month} row={editing.row} onClose={close} />
      ) : null}
    </>
  );
}
