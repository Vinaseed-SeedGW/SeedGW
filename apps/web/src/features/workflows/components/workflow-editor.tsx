'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { createContext, use, useMemo, type ReactNode } from 'react';
import {
  useFieldArray,
  useForm,
  useFormState,
  useWatch,
  type UseFormReturn,
} from 'react-hook-form';
import { formatVnd } from '@dms/contracts/format';
import {
  APPROVAL_MODE_OPTIONS,
  APPROVER_TYPE_OPTIONS,
  CONDITION_MATCH_OPTIONS,
  CONDITION_TYPE_OPTIONS,
  DEALER_TIER_OPTIONS,
  ESCALATION_TYPE_OPTIONS,
  MAX_STEP_CONDITIONS,
  MAX_WORKFLOW_STEPS,
  newApprovalStep,
  newStepCondition,
  publishWorkflowInput,
  type ApprovalStepInput,
  type ApproverType,
  type ConditionType,
  type EscalationType,
  type PublishWorkflowInput,
  type StepCondition,
  type WorkflowFormOptions,
} from '@dms/contracts/workflows';
import { Form } from '@dms/ui/form';
import {
  WorkflowPreviewPanel,
  type DraftResult,
} from '@/features/workflows/components/workflow-preview';
import { publishWorkflowAction } from '@/server/actions/workflows';

type EditorContextValue = {
  state: { form: UseFormReturn<PublishWorkflowInput>; isUnsaved: boolean };
  actions: { getDraft: () => Promise<DraftResult> };
  meta: { orgUnitId: string; options: WorkflowFormOptions };
};

const EditorContext = createContext<EditorContextValue | null>(null);

function useEditor(): EditorContextValue {
  const value = use(EditorContext);
  if (!value) throw new Error('Component nay phai nam trong WorkflowEditor.Root.');
  return value;
}

const ICON_BUTTON_CLASS =
  'inline-flex size-8 items-center justify-center rounded-md border border-border text-brand hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-40';
const ADD_BUTTON_CLASS =
  'inline-flex h-9 items-center gap-1.5 rounded-md border border-brand bg-surface px-3 font-bold text-brand hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-50';

type RootProps = {
  orgUnitId: string;
  expectedVersion: number | null;
  initialSteps: ApprovalStepInput[];
  options: WorkflowFormOptions;
  children: ReactNode;
};

function Root({ orgUnitId, expectedVersion, initialSteps, options, children }: RootProps) {
  const form = useForm<PublishWorkflowInput>({
    resolver: zodResolver(publishWorkflowInput),
    defaultValues: { orgUnitId, expectedVersion, steps: initialSteps },
  });
  const isUnsaved = expectedVersion === null || form.formState.isDirty;

  const value = useMemo<EditorContextValue>(
    () => ({
      state: { form, isUnsaved },
      actions: {
        getDraft: async () => {
          if (!isUnsaved) return { ok: true, draft: null };
          const isValid = await form.trigger('steps');
          return isValid
            ? { ok: true, draft: { orgUnitId, steps: form.getValues('steps') } }
            : { ok: false };
        },
      },
      meta: { orgUnitId, options },
    }),
    [form, isUnsaved, orgUnitId, options],
  );

  return <EditorContext value={value}>{children}</EditorContext>;
}

function EditorForm({ children }: { children: ReactNode }) {
  const { state } = useEditor();
  return (
    <Form.Root form={state.form} action={publishWorkflowAction} successMessage="Đã lưu quy trình">
      {children}
    </Form.Root>
  );
}

function FieldCell({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
}

function MoneyField({ name, label, hint }: { name: string; label: string; hint?: string }) {
  const value = Number(useWatch({ name }));
  return (
    <Form.Field name={name} label={label} hint={value > 0 ? `Bằng ${formatVnd(value)}` : hint}>
      <Form.Input type="number" inputMode="numeric" min={0} />
    </Form.Field>
  );
}

function ConditionValue({ name, condition }: { name: string; condition: StepCondition }) {
  switch (condition.type) {
    case 'TOTAL_ABOVE':
      return <MoneyField name={`${name}.amountVnd`} label="Số tiền (đ)" />;
    case 'DISCOUNT_ABOVE':
      return (
        <Form.Field name={`${name}.percent`} label="Phần trăm (%)">
          <Form.Input type="number" inputMode="decimal" min={0} max={100} step="any" />
        </Form.Field>
      );
    case 'PRODUCT_GROUP':
      return (
        <Form.Field name={`${name}.productGroup`} label="Tên nhóm sản phẩm">
          <Form.Input autoComplete="off" />
        </Form.Field>
      );
    case 'DEALER_TIER':
      return (
        <Form.Field name={`${name}.dealerTier`} label="Loại đại lý">
          <Form.ChoiceSelect options={DEALER_TIER_OPTIONS} />
        </Form.Field>
      );
    case 'OVER_CREDIT':
    case 'LOW_STOCK':
      return null;
  }
}

type ConditionProps = {
  name: string;
  condition: StepCondition;
  onChangeType: (type: ConditionType) => void;
  onRemove: () => void;
};

function Condition({ name, condition, onChangeType, onRemove }: ConditionProps) {
  return (
    <li className="grid items-start gap-2.5 rounded-md bg-surface-subtle p-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
      <label className="block">
        <span className="mb-1 block text-sm font-bold">Điều kiện</span>
        <select
          className="h-9.5 w-full rounded-md border border-input bg-surface px-2"
          value={condition.type}
          onChange={(event) => onChangeType(event.target.value as ConditionType)}
        >
          {CONDITION_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <div>
        <ConditionValue key={condition.type} name={name} condition={condition} />
      </div>
      <button
        type="button"
        aria-label="Xoá điều kiện"
        className={`${ICON_BUTTON_CLASS} sm:mt-6`}
        onClick={onRemove}
      >
        <Trash2 size={16} aria-hidden />
      </button>
    </li>
  );
}

function StepConditions({ stepIndex }: { stepIndex: number }) {
  const { state } = useEditor();
  const name = `steps.${stepIndex}.conditions` as const;
  const { fields, append, remove, update } = useFieldArray({ control: state.form.control, name });

  return (
    <div className="mt-4">
      <p className="text-sm font-bold">Điều kiện kích hoạt</p>
      <p className="text-sm text-text-muted">
        {fields.length === 0
          ? 'Chưa có điều kiện nên bước này luôn chạy.'
          : 'Bước chỉ chạy khi đơn đúng điều kiện.'}
      </p>
      {fields.length > 1 ? (
        <div className="mt-2 max-w-xs">
          <Form.Field name={`steps.${stepIndex}.conditionMatch`} label="Cách kết hợp">
            <Form.ChoiceSelect options={CONDITION_MATCH_OPTIONS} />
          </Form.Field>
        </div>
      ) : null}
      {fields.length > 0 ? (
        <ul className="mt-2 grid gap-2">
          {fields.map((field, index) => (
            <Condition
              key={field.id}
              name={`${name}.${index}`}
              condition={field}
              onChangeType={(type) => update(index, newStepCondition(type))}
              onRemove={() => remove(index)}
            />
          ))}
        </ul>
      ) : null}
      <button
        type="button"
        className={`${ADD_BUTTON_CLASS} mt-2`}
        disabled={fields.length >= MAX_STEP_CONDITIONS}
        onClick={() => append(newStepCondition('OVER_CREDIT'))}
      >
        <Plus size={16} aria-hidden />
        Thêm điều kiện
      </button>
    </div>
  );
}

function ApproverTarget({ stepIndex }: { stepIndex: number }) {
  const { meta } = useEditor();
  const type = useWatch({ name: `steps.${stepIndex}.approverType` }) as ApproverType;

  switch (type) {
    case 'ROLE':
      return (
        <Form.Field
          key={type}
          name={`steps.${stepIndex}.approverRoleId`}
          label="Vai trò"
          hint="Lấy người giữ vai trò ở đơn vị gần nhất, tính từ đơn vị người tạo đi lên."
        >
          <Form.Select options={meta.options.roles} emptyLabel="Chọn vai trò" />
        </Form.Field>
      );
    case 'JOB_TITLE':
      return (
        <Form.Field
          key={type}
          name={`steps.${stepIndex}.approverJobTitle`}
          label="Chức danh"
          hint="Lấy người giữ chức danh ở đơn vị gần nhất, tính từ đơn vị người tạo đi lên."
        >
          <Form.Select options={meta.options.jobTitles} emptyLabel="Chọn chức danh" />
        </Form.Field>
      );
    case 'USER':
      return (
        <Form.Field key={type} name={`steps.${stepIndex}.approverUserId`} label="Người duyệt">
          <Form.Select options={meta.options.users} emptyLabel="Chọn người duyệt" />
        </Form.Field>
      );
  }
}

function EscalationTarget({ stepIndex }: { stepIndex: number }) {
  const { meta } = useEditor();
  const type = useWatch({ name: `steps.${stepIndex}.escalationType` }) as EscalationType;
  if (type !== 'USER') return null;

  return (
    <FieldCell>
      <Form.Field name={`steps.${stepIndex}.escalationUserId`} label="Người nhận leo thang">
        <Form.Select options={meta.options.users} emptyLabel="Chọn người" />
      </Form.Field>
    </FieldCell>
  );
}

type StepProps = {
  index: number;
  count: number;
  onMove: (from: number, to: number) => void;
  onRemove: (index: number) => void;
};

function Step({ index, count, onMove, onRemove }: StepProps) {
  return (
    <li className="rounded-md border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-bold text-brand">Bước {index + 1}</h3>
        <div className="flex gap-1.5">
          <button
            type="button"
            aria-label={`Chuyển bước ${index + 1} lên trên`}
            className={ICON_BUTTON_CLASS}
            disabled={index === 0}
            onClick={() => onMove(index, index - 1)}
          >
            <ArrowUp size={16} aria-hidden />
          </button>
          <button
            type="button"
            aria-label={`Chuyển bước ${index + 1} xuống dưới`}
            className={ICON_BUTTON_CLASS}
            disabled={index === count - 1}
            onClick={() => onMove(index, index + 1)}
          >
            <ArrowDown size={16} aria-hidden />
          </button>
          <button
            type="button"
            aria-label={`Xoá bước ${index + 1}`}
            className={ICON_BUTTON_CLASS}
            disabled={count === 1}
            onClick={() => onRemove(index)}
          >
            <Trash2 size={16} aria-hidden />
          </button>
        </div>
      </div>

      <div className="mt-3 grid items-start gap-3.5 sm:grid-cols-2">
        <FieldCell>
          <Form.Field name={`steps.${index}.name`} label="Tên bước">
            <Form.Input autoComplete="off" />
          </Form.Field>
        </FieldCell>
        <FieldCell>
          <Form.Field name={`steps.${index}.approvalMode`} label="Kiểu duyệt">
            <Form.ChoiceSelect options={APPROVAL_MODE_OPTIONS} />
          </Form.Field>
        </FieldCell>
        <FieldCell>
          <Form.Field name={`steps.${index}.approverType`} label="Người duyệt theo">
            <Form.ChoiceSelect options={APPROVER_TYPE_OPTIONS} />
          </Form.Field>
        </FieldCell>
        <FieldCell>
          <ApproverTarget stepIndex={index} />
        </FieldCell>
        <FieldCell>
          <Form.Field name={`steps.${index}.slaHours`} label="SLA (giờ)">
            <Form.Input type="number" inputMode="numeric" min={1} max={720} />
          </Form.Field>
        </FieldCell>
        <FieldCell>
          <MoneyField
            name={`steps.${index}.skipBelowVnd`}
            label="Tự duyệt khi đơn dưới (đ)"
            hint="Để 0 nếu không tự duyệt theo giá trị đơn."
          />
        </FieldCell>
        <FieldCell>
          <Form.Field name={`steps.${index}.escalationType`} label="Leo thang khi quá hạn">
            <Form.ChoiceSelect options={ESCALATION_TYPE_OPTIONS} />
          </Form.Field>
        </FieldCell>
        <EscalationTarget stepIndex={index} />
      </div>

      <StepConditions stepIndex={index} />
    </li>
  );
}

function Steps() {
  const { state } = useEditor();
  const { fields, append, remove, move } = useFieldArray({
    control: state.form.control,
    name: 'steps',
  });
  const { errors } = useFormState({ control: state.form.control, name: 'steps' });
  const stepsError = errors.steps?.root?.message ?? errors.steps?.message;

  return (
    <>
      <ol className="grid gap-3">
        {fields.map((field, index) => (
          <Step
            key={field.id}
            index={index}
            count={fields.length}
            onMove={move}
            onRemove={remove}
          />
        ))}
      </ol>
      {stepsError ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {stepsError}
        </p>
      ) : null}
      <button
        type="button"
        className={`${ADD_BUTTON_CLASS} mt-3`}
        disabled={fields.length >= MAX_WORKFLOW_STEPS}
        onClick={() => append(newApprovalStep())}
      >
        <Plus size={16} aria-hidden />
        Thêm bước
      </button>
    </>
  );
}

function Preview() {
  const { actions, meta } = useEditor();
  return (
    <WorkflowPreviewPanel
      options={meta.options}
      defaultOrgUnitId={meta.orgUnitId}
      getDraft={actions.getDraft}
    />
  );
}

export const WorkflowEditor = {
  Root,
  Form: EditorForm,
  Steps,
  Step,
  Condition,
  Preview,
};
