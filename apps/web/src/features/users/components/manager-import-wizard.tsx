'use client';

import Link from 'next/link';
import { useMemo, useState, useTransition, type ChangeEvent } from 'react';
import type {
  ManagerImportPreview,
  ManagerImportPreviewRow,
} from '@seedgw/contracts/manager-import';
import { MAX_IMPORT_FILE_BYTES, MAX_IMPORT_ROWS } from '@seedgw/contracts/user-import';
import { downloadFile } from '@seedgw/ui/download-file';
import {
  commitManagerImportAction,
  downloadManagerImportTemplateAction,
  previewManagerImportAction,
} from '@/server/actions/manager-import';

type WizardStep =
  | { name: 'select' }
  | { name: 'preview'; fileName: string; preview: ManagerImportPreview }
  | { name: 'done'; updatedCount: number };

const OUTLINE_BUTTON =
  'inline-flex h-9.5 cursor-pointer items-center rounded-md border border-brand bg-surface px-4 font-bold text-brand hover:bg-brand-soft';
const PRIMARY_BUTTON =
  'h-9.5 rounded-md bg-brand px-4 font-bold text-primary-foreground hover:bg-brand-hover disabled:opacity-70';
const CELL_CLASS = 'border-b border-border px-2.5 py-1.5 align-top';
const HEADERS = ['Dòng', 'Mã nhân viên', 'Họ tên', 'Quản lý hiện tại', 'Quản lý mới', 'Kết quả'];

function PreviewTable({ rows }: { rows: ManagerImportPreviewRow[] }) {
  return (
    <div className="mt-3 max-h-[60vh] overflow-auto rounded-md border border-border bg-surface">
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            {HEADERS.map((header) => (
              <th
                key={header}
                className={`${CELL_CLASS} sticky top-0 bg-surface font-bold whitespace-nowrap`}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.rowNumber}
              className={row.errors.length > 0 ? 'bg-danger-soft' : undefined}
            >
              <td className={CELL_CLASS}>{row.rowNumber}</td>
              <td className={CELL_CLASS}>{row.employeeCode}</td>
              <td className={CELL_CLASS}>{row.fullName}</td>
              <td className={CELL_CLASS}>{row.currentManagerCode || 'Chưa có'}</td>
              <td className={CELL_CLASS}>{row.managerCode || 'Bỏ quản lý'}</td>
              <td className={`${CELL_CLASS} min-w-64`}>
                {row.errors.length > 0 ? (
                  <span className="text-danger">{row.errors.join('. ')}</span>
                ) : row.changed ? (
                  <span className="font-bold text-brand">Sẽ cập nhật</span>
                ) : (
                  <span className="text-text-muted">Không đổi</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Cập nhật Quản lý trực tiếp hàng loạt cho tài khoản đã có (F3b). */
export function ManagerImportWizard() {
  const [step, setStep] = useState<WizardStep>({ name: 'select' });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const sortedRows = useMemo(() => {
    if (step.name !== 'preview') return [];
    // Dòng lỗi lên đầu, rồi dòng có đổi, để không phải cuộn tìm trong file dài.
    const rank = (row: ManagerImportPreviewRow) =>
      row.errors.length > 0 ? 0 : row.changed ? 1 : 2;
    return [...step.preview.rows].sort((a, b) => rank(a) - rank(b) || a.rowNumber - b.rowNumber);
  }, [step]);

  function downloadTemplate() {
    setErrorMessage(null);
    startTransition(async () => {
      const result = await downloadManagerImportTemplateAction();
      if (result.ok) downloadFile(result.data);
      else setErrorMessage(result.message);
    });
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setErrorMessage(null);
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      setErrorMessage('File quá lớn, tối đa 900 KB');
      return;
    }
    const formData = new FormData();
    formData.set('file', file);
    startTransition(async () => {
      const result = await previewManagerImportAction(formData);
      if (result.ok) setStep({ name: 'preview', fileName: file.name, preview: result.data });
      else setErrorMessage(result.message);
    });
  }

  function commit(preview: ManagerImportPreview) {
    setErrorMessage(null);
    startTransition(async () => {
      const result = await commitManagerImportAction({
        rows: preview.rows.map(({ rowNumber, employeeCode, fullName, managerCode }) => ({
          rowNumber,
          employeeCode,
          fullName,
          managerCode,
        })),
      });
      if (result.ok) setStep({ name: 'done', updatedCount: result.data.updatedCount });
      else setErrorMessage(result.message);
    });
  }

  return (
    <>
      {step.name === 'done' ? (
        <div className="mt-4 rounded-md border border-border bg-surface p-4">
          <p className="text-lg font-bold text-brand">
            Đã cập nhật Quản lý trực tiếp cho {step.updatedCount} tài khoản
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={OUTLINE_BUTTON}
              onClick={() => setStep({ name: 'select' })}
            >
              Nhập file khác
            </button>
            <Link href="/quan-tri/tai-khoan" className="px-2 text-brand">
              Về danh sách
            </Link>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-2 max-w-3xl text-text-muted">
            File mẫu có sẵn mọi nhân viên trong phạm vi của bạn và quản lý hiện tại. Sửa cột Mã quản
            lý trực tiếp (để trống là bỏ quản lý) rồi chọn file để xem trước. Chỉ đổi Quản lý trực
            tiếp, không đổi thông tin khác. Mỗi lần tối đa {MAX_IMPORT_ROWS} dòng, chưa ghi gì cho
            tới khi bạn xác nhận.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={OUTLINE_BUTTON}
              disabled={isPending}
              onClick={downloadTemplate}
            >
              Tải file mẫu
            </button>
            <label className={OUTLINE_BUTTON}>
              {step.name === 'preview' ? 'Chọn file khác' : 'Chọn file Excel'}
              <input
                type="file"
                accept=".xlsx"
                className="sr-only"
                disabled={isPending}
                onChange={handleFile}
              />
            </label>
            {isPending ? <span className="text-text-muted">Đang xử lý...</span> : null}
          </div>
        </>
      )}

      {errorMessage ? (
        <p role="alert" className="mt-3 rounded-md bg-danger-soft px-2.5 py-2 text-danger">
          {errorMessage}
        </p>
      ) : null}

      {step.name === 'preview' ? (
        <section className="mt-5">
          <h2 className="text-lg font-bold">Xem trước {step.fileName}</h2>
          <p className="mt-1">
            {step.preview.changedCount} tài khoản sẽ cập nhật, {step.preview.errorCount} dòng lỗi.
            {step.preview.errorCount > 0
              ? ' Vui lòng sửa file và chọn lại, chỉ ghi khi không còn dòng lỗi.'
              : ''}
          </p>
          <PreviewTable rows={sortedRows} />
          <div className="mt-4">
            <button
              type="button"
              className={PRIMARY_BUTTON}
              disabled={isPending || step.preview.errorCount > 0 || step.preview.changedCount === 0}
              onClick={() => commit(step.preview)}
            >
              {isPending ? 'Đang ghi...' : `Cập nhật ${step.preview.changedCount} tài khoản`}
            </button>
          </div>
        </section>
      ) : null}
    </>
  );
}
