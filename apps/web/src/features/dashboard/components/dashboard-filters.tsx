'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import type { DayMapFilterOptions } from '@dms/contracts/check-ins';
import {
  DASHBOARD_PERIOD_LABEL,
  DASHBOARD_PERIODS,
  type DashboardInput,
} from '@dms/contracts/dashboard';
import { DEALER_LEVEL_LABEL } from '@dms/contracts/dealers';
import { isoDateToDisplay } from '@dms/contracts/format';
import { DateInput } from '@dms/ui/date-input';

const CONTROL = 'h-9.5 rounded-md border border-border bg-surface px-2.5';
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Bộ lọc dashboard nằm trên URL để gửi link được (IA §3.1). */
export function DashboardFilters({
  input,
  options,
}: {
  input: DashboardInput;
  options: DayMapFilterOptions;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function setParams(updates: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    startTransition(() => router.push(`${pathname}?${next.toString()}`));
  }

  return (
    <div className="flex flex-wrap items-end gap-3" aria-busy={isPending}>
      <label className="grid gap-1 text-sm">
        Kỳ
        <select
          className={CONTROL}
          value={input.period}
          onChange={(event) =>
            setParams({ ky: event.target.value, 'tu-ngay': null, 'den-ngay': null })
          }
        >
          {DASHBOARD_PERIODS.map((period) => (
            <option key={period} value={period}>
              {DASHBOARD_PERIOD_LABEL[period]}
            </option>
          ))}
        </select>
      </label>
      {input.period === 'tuy-chon' ? (
        <>
          <label className="grid gap-1 text-sm">
            Từ ngày
            <DateInput
              className="w-40"
              inputClassName={CONTROL}
              value={input.from}
              onValueChange={(value) => {
                if (ISO_DATE.test(value)) setParams({ 'tu-ngay': isoDateToDisplay(value) });
              }}
            />
          </label>
          <label className="grid gap-1 text-sm">
            Đến ngày
            <DateInput
              className="w-40"
              inputClassName={CONTROL}
              value={input.to}
              onValueChange={(value) => {
                if (ISO_DATE.test(value)) setParams({ 'den-ngay': isoDateToDisplay(value) });
              }}
            />
          </label>
        </>
      ) : null}
      {options.orgUnits.length > 1 ? (
        <label className="grid gap-1 text-sm">
          Đơn vị
          <select
            className={`${CONTROL} max-w-72`}
            value={input.orgUnitId ?? ''}
            onChange={(event) =>
              setParams({ 'don-vi': event.target.value || null, 'nhan-vien': null })
            }
          >
            <option value="">Tất cả đơn vị</option>
            {options.orgUnits.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {options.employees.length > 1 ? (
        <label className="grid gap-1 text-sm">
          Nhân viên
          <select
            className={`${CONTROL} max-w-80`}
            value={input.employeeCode ?? ''}
            onChange={(event) => setParams({ 'nhan-vien': event.target.value || null })}
          >
            <option value="">Tất cả nhân viên</option>
            {options.employees.map((employee) => (
              <option key={employee.code} value={employee.code}>
                {employee.code}, {employee.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="grid gap-1 text-sm">
        Cấp đại lý
        <select
          className={CONTROL}
          value={input.level ?? ''}
          onChange={(event) => setParams({ cap: event.target.value || null })}
        >
          <option value="">Tất cả các cấp</option>
          {([1, 2, 3] as const).map((level) => (
            <option key={level} value={level}>
              {DEALER_LEVEL_LABEL[level]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
