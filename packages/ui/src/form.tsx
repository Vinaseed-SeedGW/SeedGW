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
  useFormContext,
  useFormState,
  type FieldPath,
  type FieldValues,
  type UseFormReturn,
} from 'react-hook-form';
import { cn } from './cn';
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

function FormError() {
  const { state } = useFormShell();
  return state.formError ? (
    <p role="alert" className="mt-3.5 rounded-md bg-danger-soft px-2.5 py-2 text-danger">
      {state.formError}
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
  CheckboxField,
  Error: FormError,
  Actions,
  Submit,
};
