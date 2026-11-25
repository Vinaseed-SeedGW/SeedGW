'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import type { DayMapFilterOptions } from '@seedgw/contracts/check-ins';
import type { DashboardInput } from '@seedgw/contracts/dashboard';
import { DEALER_LEVEL_LABEL } from '@seedgw/contracts/dealers';
import type { ProvinceName } from '@seedgw/contracts/provinces';
import {
  provinceSlug,
  selectedProvinces,
  shortProvinceName,
  type GeoFilterOptions,
} from '@seedgw/contracts/regions';
import { DateRangeFilter } from '@/features/shell/components/date-range-filter';

const CONTROL = 'h-9.5 rounded-md border border-border bg-surface px-2.5';

/** Bộ lọc dashboard nằm trên URL để gửi link được (IA §3.1). */
export function DashboardFilters({
  input,
  options,
  geo,
}: {
  input: DashboardInput;
  options: DayMapFilterOptions;
  geo: GeoFilterOptions;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const provinceChoices = input.regionId
    ? geo.provinces.filter((row) => row.regionId === input.regionId)
    : geo.provinces;
  // Lọc vùng, tỉnh thì ô Đơn vị chỉ hiện đơn vị liên quan (đơn vị phụ trách, đơn vị cha, đơn vị con).
  const relatedTo = (provinces: ProvinceName[] | null, unitId: string) =>
    provinces === null ||
    (geo.unitProvinces[unitId] ?? []).some((name) => provinces.includes(name));
  const activeProvinces = selectedProvinces(input, geo.provinces);
  const unitChoices = options.orgUnits.filter(
    (unit) => unit.id === input.orgUnitId || relatedTo(activeProvinces, unit.id),
  );

  function setArea(regionId: string | null, provinceName: ProvinceName | null) {
    const provinces = selectedProvinces({ regionId, provinceName }, geo.provinces);
    const keepUnit = input.orgUnitId !== null && relatedTo(provinces, input.orgUnitId);
    setParams({
      vung: regionId,
      tinh: provinceName ? provinceSlug(provinceName) : null,
      vu: null,
      'nien-vu': null,
      ...(keepUnit ? {} : { 'don-vi': null, 'nhan-vien': null }),
    });
  }

  function setParams(updates: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    startTransition(() => router.push(`${pathname}?${next.toString()}`));
  }

  return (
    <div
      className="grid grid-cols-2 items-end gap-3 sm:flex sm:flex-wrap [&_select]:w-full sm:[&_select]:w-auto"
      aria-busy={isPending}
    >
      <div className="col-span-2 sm:col-span-1">
        <DateRangeFilter from={input.from} to={input.to} hint="Tối đa 366 ngày." />
      </div>
      {geo.regions.length > 0 ? (
        <label className="grid gap-1 text-sm">
          Vùng
          <select
            className={`${CONTROL} max-w-64`}
            value={input.regionId ?? ''}
            onChange={(event) => setArea(event.target.value || null, null)}
          >
            <option value="">Tất cả vùng</option>
            {geo.regions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="grid gap-1 text-sm">
        Tỉnh
        <select
          className={`${CONTROL} max-w-56`}
          value={input.provinceName ?? ''}
          onChange={(event) => {
            const name = provinceChoices.find((row) => row.name === event.target.value)?.name;
            setArea(input.regionId, name ?? null);
          }}
        >
          <option value="">Tất cả tỉnh</option>
          {provinceChoices.map((row) => (
            <option key={row.name} value={row.name}>
              {shortProvinceName(row.name)}
            </option>
          ))}
        </select>
      </label>
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
            {unitChoices.map((unit) => (
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
