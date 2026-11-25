'use client';

import {
  createContext,
  use,
  useId,
  useMemo,
  useState,
  useTransition,
  type ComponentProps,
  type ReactNode,
} from 'react';
import {
  FormProvider,
  useController,
  useFormContext,
  useFormState,
  type FieldPath,
  type FieldValues,
  type UseFormReturn,
} from 'react-hook-form';
import { cn } from './cn';
import { DateInput } from './date-input';
import { useToast } from './toast';

type FormActionResult<TData> =
  | { ok: true; data: TData; warnings?: Array<{ code: string; message: string }> }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

type FormContextValue = {
  state: { isPending: boolean; formError: string | null };
  actions: { submit: () => void };
  meta: { formId: string };
};

const FormContext = createContext<FormContextValue | null>(null);

function useFormShell(): FormContextValue {
  const value = use(FormContext);
  if (!value) throw new Error('Component nay phai nam trong Form.Root.');
  return value;
}

type RootProps<TValues extends FieldValues, TData> = {
  form: UseFormReturn<TValues>;
  action: (values: TValues) => Promise<FormActionResult<TData>>;
  successMessage: string;
  onSuccess?: (data: TData) => void;
  children: ReactNode;
};

function Root<TValues extends FieldValues, TData>({
  form,
  action,
  successMessage,
  onSuccess,
  children,
}: RootProps<TValues, TData>) {
  const { actions: toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const formId = useId();

  const submit = form.handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      const result = await action(values);
      if (result.ok) {
        form.reset(values);
        toast.show({ tone: 'success', message: successMessage });
        result.warnings?.forEach(({ message }) => toast.show({ tone: 'warning', message }));
        onSuccess?.(result.data);
        return;
      }

      const fieldErrors = Object.entries(result.fieldErrors ?? {});
      for (const [name, message] of fieldErrors) {
        form.setError(name as FieldPath<TValues>, { type: 'server', message });
      }
      if (fieldErrors.length === 0) setFormError(result.message);
    });
  });

  const value = useMemo<FormContextValue>(
    () => ({
      state: { isPending, formError },
      actions: { submit: () => void submit() },
      meta: { formId },
    }),
    [isPending, formError, submit, formId],
  );

  return (
    <FormContext value={value}>
      <FormProvider {...form}>
        <form
          id={formId}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            value.actions.submit();
          }}
        >
          {children}
        </form>
      </FormProvider>
    </FormContext>
  );
}

type FieldContextValue = {
  name: string;
  inputId: string;
  messageId: string;
  hasError: boolean;
};

const FieldContext = createContext<FieldContextValue | null>(null);

function useFieldError(name: string) {
  const { control, getFieldState } = useFormContext();
  const formState = useFormState({ control, name });
  return getFieldState(name, formState).error?.message;
}

function FieldMessage({ id, error, hint }: { id: string; error?: string; hint?: string }) {
  if (error) {
    return (
      <p id={id} className="mt-1 text-sm text-danger">
        {error}
      </p>
    );
  }
  return hint ? (
    <p id={id} className="mt-1 text-sm text-text-muted">
      {hint}
    </p>
  ) : null;
}

type FieldProps = {
  name: string;
  label: string;
  hint?: string;
  children: ReactNode;
};

function Field({ name, label, hint, children }: FieldProps) {
  const inputId = useId();
  const messageId = useId();
  const error = useFieldError(name);
  const value = useMemo(
    () => ({ name, inputId, messageId, hasError: Boolean(error) }),
    [name, inputId, messageId, error],
  );

  return (
    <FieldContext value={value}>
      <div className="mt-3.5 first:mt-0">
        <label htmlFor={inputId} className="mb-1 block text-sm font-bold">
          {label}
        </label>
        {children}
        <FieldMessage id={messageId} error={error} hint={hint} />
      </div>
    </FieldContext>
  );
}

function Input({ className, ...props }: ComponentProps<'input'>) {
  const field = use(FieldContext);
  if (!field) throw new Error('Form.Input phai nam trong Form.Field.');
  const { register } = useFormContext();

  return (
    <input
      {...props}
      {...register(field.name)}
      id={field.inputId}
      aria-invalid={field.hasError}
      aria-describedby={field.messageId}
      className={cn(
        'h-9.5 w-full rounded-md border bg-surface px-2.5',
        field.hasError ? 'border-danger' : 'border-input',
        className,
      )}
    />
  );
}

function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  const field = use(FieldContext);
  if (!field) throw new Error('Form.Textarea phai nam trong Form.Field.');
  const { register } = useFormContext();

  return (
    <textarea
      {...props}
      {...register(field.name)}
      id={field.inputId}
      aria-invalid={field.hasError}
      aria-describedby={field.messageId}
      className={cn(
        'min-h-28 w-full rounded-md border bg-surface px-2.5 py-2',
        field.hasError ? 'border-danger' : 'border-input',
        className,
      )}
    />
  );
}

function DateField() {
  const field = use(FieldContext);
  if (!field) throw new Error('Form.DateInput phai nam trong Form.Field.');
  const { field: controller } = useController({ name: field.name });

  return (
    <DateInput
      ref={controller.ref}
      id={field.inputId}
      aria-invalid={field.hasError}
      aria-describedby={field.messageId}
      className="w-full"
      inputClassName={cn(
        'h-9.5 rounded-md border bg-surface px-2.5',
        field.hasError ? 'border-danger' : 'border-input',
      )}
      value={controller.value as string}
      onValueChange={controller.onChange}
      onBlur={controller.onBlur}
    />
  );
}

type SelectProps = {
  options: ReadonlyArray<{ value: string; label: string }>;
  emptyLabel: string;
};

function Select({ options, emptyLabel }: SelectProps) {
  const field = use(FieldContext);
  if (!field) throw new Error('Form.Select phai nam trong Form.Field.');
  const { register } = useFormContext();

  return (
    <select
      {...register(field.name, { setValueAs: (value) => (value === '' ? null : value) })}
      id={field.inputId}
      aria-invalid={field.hasError}
      aria-describedby={field.messageId}
      className={cn(
        'h-9.5 w-full rounded-md border bg-surface px-2',
        field.hasError ? 'border-danger' : 'border-input',
      )}
    >
      <option value="">{emptyLabel}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

// Truong bat buoc co san gia tri mac dinh nen khong co dong trong.
function ChoiceSelect({ options }: Pick<SelectProps, 'options'>) {
  const field = use(FieldContext);
  if (!field) throw new Error('Form.ChoiceSelect phai nam trong Form.Field.');
  const { register } = useFormContext();

  return (
    <select
      {...register(field.name)}
      id={field.inputId}
      aria-invalid={field.hasError}
      aria-describedby={field.messageId}
      className={cn(
        'h-9.5 w-full rounded-md border bg-surface px-2',
        field.hasError ? 'border-danger' : 'border-input',
      )}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function CheckboxField({ name, label, hint }: Omit<FieldProps, 'children'>) {
  const inputId = useId();
  const messageId = useId();
  const error = useFieldError(name);
  const { register } = useFormContext();

  return (
    <div className="mt-3.5 first:mt-0">
      <label htmlFor={inputId} className="flex cursor-pointer items-center gap-2">
        <input
          {...register(name)}
          id={inputId}
          type="checkbox"
          className="size-4 accent-brand"
          aria-invalid={Boolean(error)}
          aria-describedby={messageId}
        />
        {label}
      </label>
      <FieldMessage id={messageId} error={error} hint={hint} />
    </div>
  );
}

type CheckboxGroupProps = Omit<FieldProps, 'children'> & {
  options: ReadonlyArray<{ value: string; label: string }>;
};

function CheckboxGroup({ name, label, hint, options }: CheckboxGroupProps) {
  const messageId = useId();
  const { field, fieldState } = useController({ name });
  const selected = field.value as string[];

  function toggle(value: string) {
    field.onChange(
      selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value],
    );
  }

  return (
    <fieldset className="mt-3.5 first:mt-0" aria-describedby={messageId}>
      <legend className="mb-1 text-sm font-bold">{label}</legend>
      <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
        {options.map((option) => (
          <label key={option.value} className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              className="size-4 accent-brand"
              checked={selected.includes(option.value)}
              onChange={() => toggle(option.value)}
              onBlur={field.onBlur}
            />
            {option.label}
          </label>
        ))}
      </div>
      <FieldMessage id={messageId} error={fieldState.error?.message} hint={hint} />
    </fieldset>
  );
}

// Gửi form có từ 2 ô sai trở lên thì báo tóm tắt ở cuối form; ô sai đầu tiên được đưa con trỏ tới (D7).
function FormError() {
  const { state } = useFormShell();
  const { formState } = useFormContext();
  const invalidCount = Object.keys(formState.errors).length;
  if (state.formError) {
    return (
      <p role="alert" className="mt-3.5 rounded-md bg-danger-soft px-2.5 py-2 text-danger">
        {state.formError}
      </p>
    );
  }
  return formState.isSubmitted && invalidCount >= 2 ? (
    <p role="alert" className="mt-3.5 rounded-md bg-danger-soft px-2.5 py-2 text-danger">
      Có {invalidCount} ô chưa đúng, xem chữ đỏ dưới từng ô rồi gửi lại.
    </p>
  ) : null;
}

function Actions({ children }: { children: ReactNode }) {
  return <div className="mt-5 flex flex-wrap items-center gap-2">{children}</div>;
}

function Submit({ children }: { children: ReactNode }) {
  const { state } = useFormShell();
  return (
    <button
      type="submit"
      disabled={state.isPending}
      className="h-9.5 rounded-md bg-brand px-4 font-bold text-primary-foreground hover:bg-brand-hover disabled:opacity-70"
    >
      {state.isPending ? 'Đang lưu...' : children}
    </button>
  );
}

export const Form = {
  Root,
  Field,
  Input,
  Textarea,
  DateInput: DateField,
  Select,
  ChoiceSelect,
  CheckboxField,
  CheckboxGroup,
  Error: FormError,
  Actions,
  Submit,
};
