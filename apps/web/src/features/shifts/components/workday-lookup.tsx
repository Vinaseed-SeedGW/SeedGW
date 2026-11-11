'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState, useTransition } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { formatDateOnly, vietnamToday } from '@dms/contracts/format';
import {
  DAY_TYPE_LABEL,
  WEEKDAY_LABEL,
  formatBreak,
  formatShiftHours,
  formatWorkUnits,
  lookupWorkdayInput,
  shiftLabel,
  weekdayOf,
  type LookupWorkdayInput,
  type WorkdayLookup as WorkdayLookupResult,
} from '@dms/contracts/shifts';
import { Form } from '@dms/ui/form';
import { lookupWorkdayAction } from '@/server/actions/shifts';

function LookupResult({ result }: { result: WorkdayLookupResult }) {
  const { shift } = result;
  return (
    <div className="mt-4 rounded-md border border-border bg-surface-subtle p-3">
      <p className="text-sm text-text-muted">
        {result.userName}, {WEEKDAY_LABEL[weekdayOf(result.date)]} ngày{' '}
        {formatDateOnly(result.date)}
      </p>
      <p className="mt-1 font-bold">
        {DAY_TYPE_LABEL[result.dayType]}
        {result.holidayName ? `: ${result.holidayName}` : ''}
      </p>
      {shift ? (
        <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_minmax(0,1fr)]">
          <dt className="text-text-muted">Ca</dt>
          <dd>{shiftLabel(shift)}</dd>
          <dt className="text-text-muted">Lấy từ</dt>
          <dd>{result.sourceLabel}</dd>
          <dt className="text-text-muted">Giờ làm</dt>
          <dd>{formatShiftHours(shift)}</dd>
          <dt className="text-text-muted">Nghỉ giữa ca</dt>
          <dd>{formatBreak(shift)}</dd>
          <dt className="text-text-muted">Số công</dt>
          <dd>{formatWorkUnits(shift.workUnits)}</dd>
        </dl>
      ) : (
        <p className="mt-1 text-sm">
          Nhân viên và các đơn vị cấp trên chưa được gán ca. Ngày này sẽ không tính công cho đến khi
          gán ca.
        </p>
      )}
    </div>
  );
}

type WorkdayLookupProps = { users: Array<{ value: string; label: string }> };

export function WorkdayLookup({ users }: WorkdayLookupProps) {
  const form = useForm<LookupWorkdayInput>({
    resolver: zodResolver(lookupWorkdayInput),
    defaultValues: { userId: '', date: vietnamToday() },
  });
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<WorkdayLookupResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const submit = form.handleSubmit((values) => {
    setErrorMessage(null);
    startTransition(async () => {
      const response = await lookupWorkdayAction(values);
      if (response.ok) {
        setResult(response.data);
      } else {
        setResult(null);
        setErrorMessage(response.message);
      }
    });
  });

  return (
    <section className="mt-6 rounded-md border border-border bg-surface p-4">
      <h2 className="font-bold text-brand">Tra cứu ca của nhân viên</h2>
      <p className="mt-1 text-sm text-text-muted">
        Chọn nhân viên và ngày để xem ca được áp dụng, lấy từ đâu và ngày đó có phải ngày làm.
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
          <div className="grid items-start gap-3.5 sm:grid-cols-[minmax(0,1fr)_12rem]">
            <div>
              <Form.Field name="userId" label="Nhân viên">
                <Form.Select options={users} emptyLabel="Chọn nhân viên" />
              </Form.Field>
            </div>
            <div>
              <Form.Field name="date" label="Ngày">
                <Form.DateInput />
              </Form.Field>
            </div>
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="mt-4 h-9.5 rounded-md border border-brand bg-surface px-4 font-bold text-brand hover:bg-brand-soft disabled:opacity-70"
          >
            {isPending ? 'Đang tra cứu...' : 'Tra cứu'}
          </button>
        </form>
      </FormProvider>
      {errorMessage ? (
        <p role="alert" className="mt-3 rounded-md bg-danger-soft px-2.5 py-2 text-danger">
          {errorMessage}
        </p>
      ) : null}
      <div aria-live="polite">{result ? <LookupResult result={result} /> : null}</div>
    </section>
  );
}
