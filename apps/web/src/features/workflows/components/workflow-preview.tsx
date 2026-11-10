'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState, useTransition } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import type { ChainStep, ChainStepStatus } from '@dms/contracts/approval-engine';
import {
  APPROVAL_MODE_LABEL,
  DEALER_TIER_OPTIONS,
  previewApprovalForm,
  type PreviewApprovalForm,
  type PreviewApprovalInput,
  type WorkflowFormOptions,
} from '@dms/contracts/workflows';
import { cn } from '@dms/ui/cn';
import { Form } from '@dms/ui/form';
import { previewApprovalAction, type ApprovalPreview } from '@/server/actions/workflows';

export type DraftResult = { ok: true; draft: PreviewApprovalInput['draft'] } | { ok: false };

const STATUS_LABEL: Record<ChainStepStatus, string> = {
  WAITING: 'Cần duyệt',
  NOT_TRIGGERED: 'Không chạy, chưa đúng điều kiện',
  SKIPPED_SELF: 'Tự duyệt, người tạo là người duyệt',
  SKIPPED_BELOW_LIMIT: 'Tự duyệt, đơn dưới ngưỡng',
  NO_APPROVER: 'Không tìm thấy người duyệt',
};

const STATUS_CLASS: Record<ChainStepStatus, string> = {
  WAITING: 'bg-brand-soft text-brand',
  NOT_TRIGGERED: 'bg-surface-subtle text-text-muted',
  SKIPPED_SELF: 'bg-surface-subtle text-text-muted',
  SKIPPED_BELOW_LIMIT: 'bg-surface-subtle text-text-muted',
  NO_APPROVER: 'bg-danger-soft text-danger',
};

function ChainStepItem({ step }: { step: ChainStep }) {
  return (
    <li className="rounded-md border border-border bg-surface p-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <b>
          Bước {step.position}: {step.name}
        </b>
        <span
          className={cn('rounded-full px-2 py-0.5 text-xs font-bold', STATUS_CLASS[step.status])}
        >
          {STATUS_LABEL[step.status]}
        </span>
      </div>
      {step.status === 'WAITING' ? (
        <>
          <ul className="mt-1">
            {step.approvers.map((approver) => (
              <li key={approver.userId}>
                {approver.fullName}
                {approver.delegatedFromName ? (
                  <span className="text-sm text-text-muted">
                    {' '}
                    (nhận uỷ quyền từ {approver.delegatedFromName})
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="text-sm text-text-muted">
            {APPROVAL_MODE_LABEL[step.approvalMode]}, SLA {step.slaHours} giờ
          </p>
        </>
      ) : null}
    </li>
  );
}

function PreviewResult({ preview }: { preview: NonNullable<ApprovalPreview> }) {
  const { chain, sourceUnitName, isInherited, isDraft } = preview;
  const waitingCount = chain.steps.filter((step) => step.status === 'WAITING').length;
  const hasMissingApprover = chain.steps.some((step) => step.status === 'NO_APPROVER');

  return (
    <div className="mt-4">
      <p className="text-sm text-text-muted">
        Theo quy trình {isInherited ? 'kế thừa từ' : 'của'} {sourceUnitName},{' '}
        {isDraft ? 'bản đang sửa, chưa lưu' : `phiên bản ${chain.workflowVersion}`}.
      </p>
      <p className="mt-1 font-bold">
        {waitingCount > 0
          ? `Đơn cần ${waitingCount} bước duyệt.`
          : hasMissingApprover
            ? 'Đơn chưa có người duyệt.'
            : 'Đơn được tự duyệt, không cần ai duyệt.'}
      </p>
      {hasMissingApprover ? (
        <p role="alert" className="mt-2 rounded-md bg-danger-soft px-2.5 py-2 text-danger">
          Có bước chưa tìm được người duyệt. Đơn thật sẽ dừng ở bước đó.
        </p>
      ) : null}
      <ol className="mt-2.5 grid gap-2">
        {chain.steps.map((step) => (
          <ChainStepItem key={step.position} step={step} />
        ))}
      </ol>
    </div>
  );
}

type WorkflowPreviewPanelProps = {
  options: Pick<WorkflowFormOptions, 'units' | 'users'>;
  defaultOrgUnitId: string;
  getDraft?: () => Promise<DraftResult>;
};

type PanelResult = { preview: ApprovalPreview };

export function WorkflowPreviewPanel({
  options,
  defaultOrgUnitId,
  getDraft,
}: WorkflowPreviewPanelProps) {
  const form = useForm<PreviewApprovalForm>({
    resolver: zodResolver(previewApprovalForm),
    defaultValues: {
      orgUnitId: defaultOrgUnitId,
      creatorId: null,
      totalVnd: 0,
      discountPercent: 0,
      isOverCredit: false,
      isLowStock: false,
      productGroup: '',
      dealerTier: null,
    },
  });
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<PanelResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const submit = form.handleSubmit((values) => {
    setErrorMessage(null);
    startTransition(async () => {
      const draftResult: DraftResult = getDraft ? await getDraft() : { ok: true, draft: null };
      if (!draftResult.ok) {
        setResult(null);
        setErrorMessage('Quy trình đang sửa còn lỗi, vui lòng sửa trước khi xem trước.');
        return;
      }
      const response = await previewApprovalAction({ ...values, draft: draftResult.draft });
      if (response.ok) {
        setResult({ preview: response.data });
      } else {
        setResult(null);
        setErrorMessage(response.message);
      }
    });
  });

  return (
    <section className="mt-6 rounded-md border border-border bg-surface p-4">
      <h2 className="font-bold text-brand">Xem trước với đơn giả định</h2>
      <p className="mt-1 text-sm text-text-muted">
        Nhập thông tin một đơn để xem đơn đi qua những bước nào và ai duyệt. Không tạo đơn thật.
      </p>
      <FormProvider {...form}>
        <form
          noValidate
          className="mt-3"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="grid items-start gap-3.5 sm:grid-cols-2">
            <div>
              <Form.Field name="orgUnitId" label="Đơn vị của người tạo đơn">
                <Form.Select options={options.units} emptyLabel="Chọn đơn vị" />
              </Form.Field>
            </div>
            <div>
              <Form.Field
                name="creatorId"
                label="Người tạo đơn"
                hint="Không bắt buộc. Chọn để kiểm tra trường hợp người tạo cũng là người duyệt."
              >
                <Form.Select options={options.users} emptyLabel="Không chọn" />
              </Form.Field>
            </div>
            <div>
              <Form.Field name="totalVnd" label="Tổng tiền (đ)">
                <Form.Input type="number" inputMode="numeric" min={0} />
              </Form.Field>
            </div>
            <div>
              <Form.Field name="discountPercent" label="Chiết khấu (%)">
                <Form.Input type="number" inputMode="decimal" min={0} max={100} step="any" />
              </Form.Field>
            </div>
            <div>
              <Form.Field name="productGroup" label="Nhóm sản phẩm trong đơn">
                <Form.Input autoComplete="off" />
              </Form.Field>
            </div>
            <div>
              <Form.Field name="dealerTier" label="Loại đại lý">
                <Form.Select options={DEALER_TIER_OPTIONS} emptyLabel="Không chọn" />
              </Form.Field>
            </div>
          </div>
          <Form.CheckboxField name="isOverCredit" label="Đơn có cờ vượt hạn mức công nợ" />
          <Form.CheckboxField name="isLowStock" label="Đơn có cờ thiếu tồn kho" />
          <button
            type="submit"
            disabled={isPending}
            className="mt-4 h-9.5 rounded-md border border-brand bg-surface px-4 font-bold text-brand hover:bg-brand-soft disabled:opacity-70"
          >
            {isPending ? 'Đang tính...' : 'Xem trước'}
          </button>
        </form>
      </FormProvider>
      {errorMessage ? (
        <p role="alert" className="mt-3 rounded-md bg-danger-soft px-2.5 py-2 text-danger">
          {errorMessage}
        </p>
      ) : null}
      {result ? (
        result.preview ? (
          <PreviewResult preview={result.preview} />
        ) : (
          <p className="mt-4 rounded-md bg-warning-soft px-3 py-2">
            Chưa có quy trình nào áp dụng cho đơn vị này.
          </p>
        )
      ) : null}
    </section>
  );
}
