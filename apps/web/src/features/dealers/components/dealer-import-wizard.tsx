'use client';

import Link from 'next/link';
import { useState, useTransition, type ChangeEvent } from 'react';
import {
  DEALER_LEVEL_LABEL,
  DEALER_LEVELS,
  MAX_DEALER_IMPORT_BYTES,
  type DealerImportIssue,
  type DealerImportPreview,
  type DealerImportResult,
  type DealerImportUnitAction,
  type DealerImportUnitChoice,
  type DealerOption,
} from '@dms/contracts/dealers';
import { formatNumber } from '@dms/contracts/format';
import { commitDealerImportAction, previewDealerImportAction } from '@/server/actions/dealers';

type Step =
  | { name: 'select' }
  | { name: 'preview'; file: File; preview: DealerImportPreview }
  | { name: 'done'; result: DealerImportResult };

const OUTLINE_BUTTON =
  'inline-flex h-9.5 cursor-pointer items-center rounded-md border border-brand bg-surface px-4 font-bold text-brand hover:bg-brand-soft';
const PRIMARY_BUTTON =
  'h-9.5 rounded-md bg-brand px-4 font-bold text-primary-foreground hover:bg-brand-hover disabled:opacity-70';
const CELL = 'border-b border-border px-2.5 py-1.5 align-top';
const CONTROL = 'h-9 rounded-md border border-input bg-surface px-2';

const ACTION_LABEL: Record<DealerImportUnitAction, string> = {
  CREATE: 'Tạo đơn vị mới',
  EXISTING: 'Dùng đơn vị có sẵn',
  SKIP: 'Bỏ qua các dòng này',
};

function initialChoices(preview: DealerImportPreview): DealerImportUnitChoice[] {
  return preview.units.map((unit) => ({
    legacyName: unit.legacyName,
    action: unit.suggestedAction,
    orgUnitId: unit.matchedOrgUnitId,
    code: unit.suggestedCode,
  }));
}

export function DealerImportWizard({ orgUnits }: { orgUnits: DealerOption[] }) {
  const [step, setStep] = useState<Step>({ name: 'select' });
  const [choices, setChoices] = useState<DealerImportUnitChoice[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setErrorMessage(null);
    if (file.size > MAX_DEALER_IMPORT_BYTES) {
      setErrorMessage('File quá lớn, tối đa 12 MB');
      return;
    }
    const formData = new FormData();
    formData.set('file', file);
    startTransition(async () => {
      const result = await previewDealerImportAction(formData);
      if (!result.ok) {
        setErrorMessage(result.message);
        return;
      }
      setChoices(initialChoices(result.data));
      setStep({ name: 'preview', file, preview: result.data });
    });
  }

  function updateChoice(index: number, patch: Partial<DealerImportUnitChoice>) {
    setChoices((current) =>
      current.map((choice, i) => (i === index ? { ...choice, ...patch } : choice)),
    );
  }

  function commit(file: File) {
    setErrorMessage(null);
    const formData = new FormData();
    formData.set('file', file);
    formData.set('units', JSON.stringify(choices));
    startTransition(async () => {
      const result = await commitDealerImportAction(formData);
      if (result.ok) setStep({ name: 'done', result: result.data });
      else setErrorMessage(result.message);
    });
  }

  if (step.name === 'done') {
    const { result } = step;
    return (
      <div className="mt-4 rounded-md border border-border bg-surface p-4">
        <p className="text-lg font-bold text-brand">Đã nhập xong</p>
        <ul className="mt-2 list-none space-y-1">
          <li>{formatNumber(result.created)} đại lý mới</li>
          <li>{formatNumber(result.updated)} đại lý cập nhật</li>
          <li>{formatNumber(result.skipped)} dòng bỏ qua theo đơn vị đã chọn</li>
          <li>{formatNumber(result.errorCount)} dòng lỗi không nhập</li>
          <li>{formatNumber(result.createdUnits)} đơn vị mới trong Cơ cấu tổ chức</li>
        </ul>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/quan-tri/dai-ly" className="text-brand">
            Về danh sách đại lý
          </Link>
          <Link href="/quan-tri/co-cau-to-chuc" className="text-brand">
            Sửa tên, vị trí đơn vị ở Cơ cấu tổ chức
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mt-3 flex flex-wrap items-center gap-2">
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
        {isPending ? <span className="text-text-muted">Đang đọc và kiểm tra file...</span> : null}
      </div>

      {errorMessage ? (
        <p role="alert" className="mt-3 rounded-md bg-danger-soft px-2.5 py-2 text-danger">
          {errorMessage}
        </p>
      ) : null}

      {step.name === 'preview' ? (
        <Preview
          fileName={step.file.name}
          preview={step.preview}
          choices={choices}
          orgUnits={orgUnits}
          isPending={isPending}
          onChange={updateChoice}
          onCommit={() => commit(step.file)}
        />
      ) : null}
    </>
  );
}

type PreviewProps = {
  fileName: string;
  preview: DealerImportPreview;
  choices: DealerImportUnitChoice[];
  orgUnits: DealerOption[];
  isPending: boolean;
  onChange: (index: number, patch: Partial<DealerImportUnitChoice>) => void;
  onCommit: () => void;
};

function Preview({
  fileName,
  preview,
  choices,
  orgUnits,
  isPending,
  onChange,
  onCommit,
}: PreviewProps) {
  const importedRows = preview.units.reduce(
    (total, unit, i) => total + (choices[i]?.action === 'SKIP' ? 0 : unit.rowCount),
    0,
  );
  const incomplete = choices.some(
    (choice) =>
      (choice.action === 'EXISTING' && !choice.orgUnitId) ||
      (choice.action === 'CREATE' && !choice.code),
  );

  return (
    <section className="mt-5 space-y-5">
      <div className="rounded-md border border-border bg-surface p-4">
        <h2 className="text-lg font-bold">Tóm tắt {fileName}</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Số dòng trong file" value={preview.totalRows} />
          <Stat label="Dòng hợp lệ" value={preview.validRows} />
          <Stat label="Đại lý mới" value={preview.newCount} />
          <Stat label="Đã có, sẽ cập nhật" value={preview.existingCount} />
          {DEALER_LEVELS.map((level) => (
            <Stat
              key={level}
              label={DEALER_LEVEL_LABEL[level]}
              value={preview.levelCounts[level]}
            />
          ))}
          <Stat label="Có mã FAST" value={preview.withFastCode} />
          <Stat label="Ghép được nhân viên" value={preview.assigneeMatched} />
          <Stat label="Chờ gán nhân viên" value={preview.assigneeUnmatched} />
          <Stat label="Số điện thoại sai dạng" value={preview.invalidPhoneCount} />
        </dl>
        <p className="mt-3 text-sm text-text-muted">
          Tỉnh, thành phố được đổi sang 34 tỉnh mới. Xã, huyện, tỉnh cũ giữ nguyên để tham khảo.
          Nhân viên chưa có tài khoản để chờ gán, sau khi nhập tài khoản bấm Ghép nhân viên theo
          tên.
        </p>
      </div>

      <div className="rounded-md border border-border bg-surface p-4">
        <h2 className="text-lg font-bold">Đơn vị phụ trách</h2>
        <p className="mt-1 text-sm text-text-muted">
          Mặc định tạo đơn vị mới đúng tên trên DMS cũ, đặt dưới đơn vị gốc. Sau này đổi tên, gộp,
          chuyển vị trí ở trang Cơ cấu tổ chức, hoặc chuyển đại lý sang đơn vị khác bằng nút Đổi đơn
          vị ở danh sách đại lý.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr>
                {[
                  'Đơn vị trên DMS cũ',
                  'Số đại lý',
                  'Cách xử lý',
                  'Mã đơn vị mới hoặc đơn vị có sẵn',
                ].map((header) => (
                  <th key={header} className={`${CELL} font-bold whitespace-nowrap`}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.units.map((unit, index) => {
                const choice = choices[index];
                if (!choice) return null;
                return (
                  <tr key={unit.legacyName}>
                    <td className={`${CELL} min-w-64`}>{unit.legacyName || '(trống)'}</td>
                    <td className={`${CELL} text-right`}>{formatNumber(unit.rowCount)}</td>
                    <td className={CELL}>
                      <select
                        aria-label={`Cách xử lý đơn vị ${unit.legacyName}`}
                        className={CONTROL}
                        value={choice.action}
                        onChange={(e) =>
                          onChange(index, { action: e.target.value as DealerImportUnitAction })
                        }
                      >
                        {(Object.keys(ACTION_LABEL) as DealerImportUnitAction[]).map((action) => (
                          <option key={action} value={action}>
                            {ACTION_LABEL[action]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className={CELL}>
                      {choice.action === 'CREATE' ? (
                        <input
                          aria-label={`Mã đơn vị mới cho ${unit.legacyName}`}
                          className={`${CONTROL} w-40 uppercase`}
                          value={choice.code ?? ''}
                          onChange={(e) =>
                            onChange(index, { code: e.target.value.toUpperCase() || null })
                          }
                        />
                      ) : choice.action === 'EXISTING' ? (
                        <select
                          aria-label={`Đơn vị có sẵn cho ${unit.legacyName}`}
                          className={`${CONTROL} max-w-md`}
                          value={choice.orgUnitId ?? ''}
                          onChange={(e) => onChange(index, { orgUnitId: e.target.value || null })}
                        >
                          <option value="">Chọn đơn vị</option>
                          {orgUnits.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-text-muted">Không nhập</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <IssueList
        title="Dòng lỗi, sẽ không nhập"
        issues={preview.errors}
        total={preview.errorCount}
        tone="danger"
      />
      <IssueList
        title="Cảnh báo, vẫn nhập"
        issues={preview.warnings}
        total={preview.warningCount}
        tone="warning"
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={PRIMARY_BUTTON}
          disabled={isPending || incomplete}
          onClick={onCommit}
        >
          {isPending ? 'Đang nhập...' : `Nhập ${formatNumber(importedRows)} đại lý`}
        </button>
        {incomplete ? (
          <span className="text-danger">Chọn đơn vị có sẵn hoặc nhập mã cho mọi đơn vị.</span>
        ) : null}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-sm text-text-muted">{label}</dt>
      <dd className="text-xl font-bold">{formatNumber(value)}</dd>
    </div>
  );
}

function IssueList({
  title,
  issues,
  total,
  tone,
}: {
  title: string;
  issues: DealerImportIssue[];
  total: number;
  tone: 'danger' | 'warning';
}) {
  if (total === 0) return null;
  return (
    <details className="rounded-md border border-border bg-surface p-4">
      <summary className={`cursor-pointer font-bold ${tone === 'danger' ? 'text-danger' : ''}`}>
        {title}: {formatNumber(total)} dòng
        {total > issues.length ? `, hiện ${formatNumber(issues.length)} dòng đầu` : ''}
      </summary>
      <div className="mt-2 max-h-80 overflow-auto">
        <table className="w-full text-left text-sm">
          <tbody>
            {issues.map((issue) => (
              <tr key={`${issue.rowNumber}-${issue.message}`}>
                <td className={`${CELL} whitespace-nowrap`}>Dòng {issue.rowNumber}</td>
                <td className={`${CELL} whitespace-nowrap`}>{issue.legacyCode}</td>
                <td className={CELL}>{issue.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
