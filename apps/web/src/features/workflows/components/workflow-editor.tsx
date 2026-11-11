'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2 } from 'lucide-react';
import {
  createContext,
  use,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
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
  type SelectOption,
  type StepCondition,
  type WorkflowFormOptions,
} from '@dms/contracts/workflows';
import { cn } from '@dms/ui/cn';
import { Form } from '@dms/ui/form';
import {
  WorkflowPreviewPanel,
  type DraftResult,
} from '@/features/workflows/components/workflow-preview';
import { isNoopSlot, useStepDrag } from '@/features/workflows/hooks/use-step-drag';
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
  'inline-flex size-11 flex-none items-center justify-center rounded-md border border-border text-brand hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-40 sm:size-8';
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

const PALETTE: { type: ApproverType; label: string }[] = [
  { type: 'ROLE', label: 'Duyệt theo vai trò' },
  { type: 'JOB_TITLE', label: 'Duyệt theo chức danh' },
  { type: 'USER', label: 'Người duyệt cụ thể' },
];

function optionLabel(options: readonly SelectOption[], value: string | null): string | null {
  if (!value) return null;
  return options.find((option) => option.value === value)?.label ?? null;
}

function useStepSummary(index: number): { title: string; detail: string } {
  const { meta } = useEditor();
  const step = useWatch({ name: `steps.${index}` }) as ApprovalStepInput | undefined;
  if (!step) return { title: '', detail: '' };

  const target =
    step.approverType === 'ROLE'
      ? `Vai trò ${optionLabel(meta.options.roles, step.approverRoleId) ?? 'chưa chọn'}`
      : step.approverType === 'JOB_TITLE'
        ? `Chức danh ${step.approverJobTitle ?? 'chưa chọn'}`
        : (optionLabel(meta.options.users, step.approverUserId) ?? 'Chưa chọn người duyệt');
  const conditions = step.conditions.length > 0 ? `, ${step.conditions.length} điều kiện` : '';
  return { title: step.name.trim() || 'Chưa đặt tên', detail: `${target}${conditions}` };
}

type StepRowProps = {
  index: number;
  isSelected: boolean;
  isDragged: boolean;
  hasError: boolean;
  onSelect: () => void;
  onHandlePointerDown: (event: ReactPointerEvent<HTMLElement>, label: string) => void;
  onHandleKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
};

function StepRow({
  index,
  isSelected,
  isDragged,
  hasError,
  onSelect,
  onHandlePointerDown,
  onHandleKeyDown,
}: StepRowProps) {
  const { title, detail } = useStepSummary(index);
  const position = index + 1;

  return (
    <div
      data-step-row
      className={cn(
        'flex items-stretch rounded-md border',
        isSelected ? 'border-brand bg-brand-soft' : 'border-border bg-surface',
        isDragged && 'opacity-40',
      )}
    >
      <button
        type="button"
        data-step-handle={index}
        aria-label={`Kéo để đổi thứ tự bước ${position}, hoặc dùng phím mũi tên lên xuống`}
        className="flex w-11 flex-none cursor-grab touch-none items-center justify-center text-text-muted hover:text-brand sm:w-9"
        onPointerDown={(event) => onHandlePointerDown(event, `Bước ${position}: ${title}`)}
        onKeyDown={onHandleKeyDown}
      >
        <GripVertical size={18} aria-hidden />
      </button>
      <button
        type="button"
        aria-current={isSelected ? 'step' : undefined}
        className="min-h-11 min-w-0 flex-1 py-2 pr-3 text-left"
        onClick={onSelect}
      >
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <b className="text-brand">Bước {position}</b>
          <span className="min-w-0 truncate font-bold">{title}</span>
          {hasError ? (
            <span className="rounded-full bg-danger-soft px-2 py-0.5 text-xs font-bold text-danger">
              Còn lỗi
            </span>
          ) : null}
        </span>
        <span className="block truncate text-sm text-text-muted">{detail}</span>
      </button>
    </div>
  );
}

function DropLine({ isVisible }: { isVisible: boolean }) {
  return (
    <div aria-hidden className="relative h-0">
      {isVisible ? (
        <div className="absolute inset-x-0 -top-1.25 h-0.5 rounded-full bg-brand" />
      ) : null}
    </div>
  );
}

type StepDetailProps = {
  index: number;
  count: number;
  onMove: (from: number, to: number) => void;
  onRemove: (index: number) => void;
};

function StepDetail({ index, count, onMove, onRemove }: StepDetailProps) {
  const position = index + 1;
  return (
    <section
      id="chi-tiet-buoc"
      aria-labelledby="buoc-dang-sua"
      className="scroll-mt-18 rounded-md border border-border bg-surface p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 id="buoc-dang-sua" className="font-bold text-brand">
          Bước {position}
        </h3>
        <div className="flex gap-1.5">
          <button
            type="button"
            aria-label={`Chuyển bước ${position} lên trên`}
            className={ICON_BUTTON_CLASS}
            disabled={index === 0}
            onClick={() => onMove(index, index - 1)}
          >
            <ArrowUp size={16} aria-hidden />
          </button>
          <button
            type="button"
            aria-label={`Chuyển bước ${position} xuống dưới`}
            className={ICON_BUTTON_CLASS}
            disabled={index === count - 1}
            onClick={() => onMove(index, index + 1)}
          >
            <ArrowDown size={16} aria-hidden />
          </button>
          <button
            type="button"
            aria-label={`Xoá bước ${position}`}
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
    </section>
  );
}

// Giu buoc dang chon dung la buoc do sau khi doi thu tu.
function indexAfterMove(selected: number, from: number, to: number): number {
  if (selected === from) return to;
  if (from < selected && selected <= to) return selected - 1;
  if (to <= selected && selected < from) return selected + 1;
  return selected;
}

type FocusTarget = { kind: 'name' | 'handle' | 'reveal'; tick: number };

function Steps() {
  const { state } = useEditor();
  const { control, setFocus } = state.form;
  const { fields, insert, remove, move } = useFieldArray({ control, name: 'steps' });
  const { errors, submitCount } = useFormState({ control, name: 'steps' });
  const [selected, setSelected] = useState(0);
  const [announcement, setAnnouncement] = useState('');
  const [focusTarget, setFocusTarget] = useState<FocusTarget | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const count = fields.length;
  const selectedIndex = Math.min(selected, count - 1);
  const stepErrors = errors.steps;
  const stepsError = stepErrors?.root?.message ?? stepErrors?.message;
  const isFull = count >= MAX_WORKFLOW_STEPS;

  const moveStep = (from: number, to: number) => {
    if (to < 0 || to >= count || from === to) return;
    move(from, to);
    setSelected((current) => indexAfterMove(current, from, to));
    setAnnouncement(`Đã chuyển bước ${from + 1} tới vị trí ${to + 1}.`);
  };

  const addStep = (approverType: ApproverType, slot: number) => {
    if (isFull) return;
    insert(slot, { ...newApprovalStep(), approverType }, { shouldFocus: false });
    setSelected(slot);
    setFocusTarget({ kind: 'name', tick: Date.now() });
    setAnnouncement(`Đã thêm bước mới ở vị trí ${slot + 1}.`);
  };

  const removeStep = (index: number) => {
    remove(index);
    setSelected((current) => (current > index ? current - 1 : Math.min(current, count - 2)));
    setAnnouncement(`Đã xoá bước ${index + 1}.`);
  };

  const { drag, startDrag } = useStepDrag({
    listRef,
    onDrop: (source, slot) => {
      if (source.kind === 'insert') {
        addStep(source.approverType, slot);
        return;
      }
      moveStep(source.fromIndex, slot > source.fromIndex ? slot - 1 : slot);
    },
  });

  // Loi cua buoc dang dong khong hien duoi o nhap, nen mo buoc loi dau tien sau moi lan bam Luu.
  const [seenSubmitCount, setSeenSubmitCount] = useState(submitCount);
  if (submitCount !== seenSubmitCount) {
    setSeenSubmitCount(submitCount);
    if (stepErrors && stepErrors[selectedIndex] === undefined) {
      const first = fields.findIndex((_, index) => stepErrors[index] !== undefined);
      if (first >= 0) setSelected(first);
    }
  }

  useEffect(() => {
    switch (focusTarget?.kind) {
      case 'name':
        setFocus(`steps.${selectedIndex}.name`);
        return;
      case 'handle':
        listRef.current
          ?.querySelector<HTMLButtonElement>(`[data-step-handle="${selectedIndex}"]`)
          ?.focus();
        return;
      case 'reveal': {
        // Man hinh hep xep chi tiet duoi danh sach, chi cuon khi phan chi tiet dang khuat.
        const detail = document.getElementById('chi-tiet-buoc');
        if (detail && detail.getBoundingClientRect().top > window.innerHeight - 120) {
          detail.scrollIntoView({ block: 'start' });
        }
        return;
      }
    }
  }, [focusTarget, selectedIndex, setFocus]);

  const dropSlot =
    drag && drag.slot !== null && !isNoopSlot(drag.source, drag.slot) ? drag.slot : null;
  const draggedIndex = drag?.source.kind === 'move' ? drag.source.fromIndex : null;
  const selectedField = fields[selectedIndex];

  return (
    <div className={cn(drag && 'select-none')}>
      <h2 className="mb-1 font-bold text-brand">Các bước duyệt</h2>
      <p className="mb-3 text-sm text-text-muted">
        Kéo biểu tượng ở đầu mỗi bước để đổi thứ tự. Bấm vào một bước để sửa chi tiết.
      </p>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className="xl:sticky xl:top-18">
          <div ref={listRef} role="list" aria-label="Chuỗi bước duyệt" className="grid gap-2">
            {fields.map((field, index) => (
              <div key={field.id} role="listitem">
                <DropLine isVisible={dropSlot === index} />
                <StepRow
                  index={index}
                  isSelected={index === selectedIndex}
                  isDragged={draggedIndex === index}
                  hasError={stepErrors?.[index] !== undefined}
                  onSelect={() => {
                    setSelected(index);
                    setFocusTarget({ kind: 'reveal', tick: Date.now() });
                  }}
                  onHandlePointerDown={(event, label) =>
                    startDrag({ kind: 'move', fromIndex: index, label })(event)
                  }
                  onHandleKeyDown={(event) => {
                    const to =
                      event.key === 'ArrowUp'
                        ? index - 1
                        : event.key === 'ArrowDown'
                          ? index + 1
                          : null;
                    if (to === null) return;
                    event.preventDefault();
                    if (to < 0 || to >= count) return;
                    moveStep(index, to);
                    setSelected(to);
                    setFocusTarget({ kind: 'handle', tick: Date.now() });
                  }}
                />
              </div>
            ))}
            <DropLine isVisible={dropSlot === count} />
          </div>
          {stepsError ? (
            <p role="alert" className="mt-2 text-sm text-danger">
              {stepsError}
            </p>
          ) : null}

          <div className="mt-4 rounded-md border border-dashed border-input p-3">
            <p className="text-sm font-bold">Thêm bước</p>
            <p className="text-sm text-text-muted">
              {isFull
                ? `Đã đủ ${MAX_WORKFLOW_STEPS} bước, không thêm được nữa.`
                : 'Kéo một khối vào chuỗi để chèn đúng vị trí, hoặc bấm để thêm vào cuối.'}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {PALETTE.map((item) => (
                <button
                  key={item.type}
                  type="button"
                  disabled={isFull}
                  className={`${ADD_BUTTON_CLASS} min-h-11 cursor-grab touch-none sm:min-h-0`}
                  onPointerDown={startDrag({
                    kind: 'insert',
                    approverType: item.type,
                    label: item.label,
                  })}
                  onClick={() => addStep(item.type, count)}
                >
                  <Plus size={16} aria-hidden />
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {selectedField ? (
          <StepDetail
            key={selectedField.id}
            index={selectedIndex}
            count={count}
            onMove={moveStep}
            onRemove={removeStep}
          />
        ) : null}
      </div>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      {drag ? (
        <div
          aria-hidden
          className="pointer-events-none fixed z-50 max-w-64 truncate rounded-md border-2 border-brand bg-surface px-3 py-2 font-bold text-brand"
          style={{ left: drag.x + 14, top: drag.y + 14 }}
        >
          {drag.source.label}
        </div>
      ) : null}
    </div>
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
  StepDetail,
  Condition,
  Preview,
};
