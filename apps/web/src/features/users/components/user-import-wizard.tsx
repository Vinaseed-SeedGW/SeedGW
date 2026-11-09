'use client';

import Link from 'next/link';
import { useMemo, useState, useTransition, type ChangeEvent } from 'react';
import type { ExportedFile } from '@dms/contracts/common';
import {
  MAX_IMPORT_FILE_BYTES,
  MAX_IMPORT_ROWS,
  type UserImportPreview,
  type UserImportPreviewRow,
} from '@dms/contracts/user-import';
import { downloadFile } from '@dms/ui/download-file';
import {
  commitUserImportAction,
  downloadUserImportTemplateAction,
  previewUserImportAction,
} from '@/server/actions/user-import';

type WizardStep =
  | { name: 'select' }
  | { name: 'preview'; fileName: string; preview: UserImportPreview }
  | { name: 'done'; createdCount: number; file: ExportedFile };

const OUTLINE_BUTTON =
  'inline-flex h-9.5 cursor-pointer items-center rounded-md border border-brand bg-surface px-4 font-bold text-brand hover:bg-brand-soft';
const PRIMARY_BUTTON =
  'h-9.5 rounded-md bg-brand px-4 font-bold text-primary-foreground hover:bg-brand-hover disabled:opacity-70';

const CELL_CLASS = 'border-b border-border px-2.5 py-1.5 align-top';
const HEADERS = [
  'Dòng',
  'Mã nhân viên',
  'Họ tên',
  'Số điện thoại',
  'Email',
  'Mã đơn vị',
  'Chức danh',
  'Ngày vào làm',
  'Mã quản lý',
  'Mã vai trò',
  'Lỗi',
];

function PreviewTable({ rows }: { rows: UserImportPreviewRow[] }) {
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
              <td className={CELL_CLASS}>{row.phone}</td>
              <td className={CELL_CLASS}>{row.email}</td>
              <td className={CELL_CLASS}>{row.orgUnitCode}</td>
              <td className={CELL_CLASS}>{row.jobTitle}</td>
              <td className={CELL_CLASS}>{row.hiredAt}</td>
              <td className={CELL_CLASS}>{row.managerCode}</td>
              <td className={CELL_CLASS}>{row.roleCodes}</td>
              <td className={`${CELL_CLASS} min-w-64 text-danger`}>{row.errors.join('. ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function UserImportWizard() {
  const [step, setStep] = useState<WizardStep>({ name: 'select' });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const sortedRows = useMemo(() => {
    if (step.name !== 'preview') return [];
    // Dua dong loi len dau de khong phai cuon tim trong file dai.
    return [...step.preview.rows].sort(
      (a, b) =>
        Number(b.errors.length > 0) - Number(a.errors.length > 0) || a.rowNumber - b.rowNumber,
    );
  }, [step]);

  function downloadTemplate() {
    setErrorMessage(null);
    startTransition(async () => {
      const result = await downloadUserImportTemplateAction();
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
      const result = await previewUserImportAction(formData);
      if (result.ok) setStep({ name: 'preview', fileName: file.name, preview: result.data });
      else setErrorMessage(result.message);
    });
  }

  function commit(preview: UserImportPreview) {
    setErrorMessage(null);
    startTransition(async () => {
      const result = await commitUserImportAction({
        rows: preview.rows.map(({ errors: _errors, ...row }) => row),
      });
      if (result.ok) setStep({ name: 'done', ...result.data });
      else setErrorMessage(result.message);
    });
  }

  return (
    <>
      {step.name === 'done' ? (
        <div className="mt-4 rounded-md border border-border bg-surface p-4">
          <p className="text-lg font-bold text-brand">Đã tạo {step.createdCount} tài khoản</p>
          <p className="mt-1">
            Hãy tải danh sách mật khẩu tạm và giao cho từng nhân viên. Danh sách chỉ tải được ở màn
            hình này, sau đó phải đặt lại mật khẩu từng người.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={PRIMARY_BUTTON}
              onClick={() => downloadFile(step.file)}
            >
              Tải danh sách mật khẩu tạm
            </button>
            <Link href="/quan-tri/tai-khoan" className="px-2 text-brand">
              Về danh sách
            </Link>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-2 text-text-muted">
            Tải file mẫu, điền thông tin ở sheet đầu tiên rồi chọn file để xem trước. Mỗi lần nhập
            tối đa {MAX_IMPORT_ROWS} dòng và chưa có gì được ghi cho đến khi bạn xác nhận.
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
            {step.preview.validCount} dòng hợp lệ, {step.preview.errorCount} dòng lỗi.
            {step.preview.errorCount > 0
              ? ' Vui lòng sửa file và chọn lại, chỉ ghi khi không còn dòng lỗi.'
              : ''}
          </p>
          <PreviewTable rows={sortedRows} />
          <div className="mt-4">
            <button
              type="button"
              className={PRIMARY_BUTTON}
              disabled={isPending || step.preview.errorCount > 0}
              onClick={() => commit(step.preview)}
            >
              {isPending ? 'Đang ghi...' : `Ghi ${step.preview.validCount} tài khoản`}
            </button>
          </div>
        </section>
      ) : null}
    </>
  );
}
