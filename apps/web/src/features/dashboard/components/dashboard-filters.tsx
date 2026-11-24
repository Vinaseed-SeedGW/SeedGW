'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import type { DayMapFilterOptions } from '@seedgw/contracts/check-ins';
import {
  DASHBOARD_PERIOD_LABEL,
  DASHBOARD_PERIODS,
  seasonsForRegion,
  type DashboardInput,
  type SeasonRange,
} from '@seedgw/contracts/dashboard';
import { DEALER_LEVEL_LABEL } from '@seedgw/contracts/dealers';
import { isoDateToDisplay, vietnamToday } from '@seedgw/contracts/format';
import type { ProvinceName } from '@seedgw/contracts/provinces';
import {
  provinceSlug,
  selectedProvinces,
  shortProvinceName,
  type GeoFilterOptions,
} from '@seedgw/contracts/regions';
import { seasonYearLabel, seasonYearOptions } from '@seedgw/contracts/seasons';
import { DateInput } from '@seedgw/ui/date-input';

const CONTROL = 'h-9.5 rounded-md border border-border bg-surface px-2.5';
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Bộ lọc dashboard nằm trên URL để gửi link được (IA §3.1). */
export function DashboardFilters({
  input,
  options,
  seasons,
  geo,
}: {
  input: DashboardInput;
  options: DayMapFilterOptions;
  seasons: readonly SeasonRange[];
  geo: GeoFilterOptions;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const selectedSeason = seasons.find((season) => season.id === input.seasonId) ?? null;
  const regionOf = (name: ProvinceName) =>
    geo.provinces.find((row) => row.name === name)?.regionId ?? null;
  const seasonChoices = seasonsForRegion(
    seasons,
    input.regionId ?? (input.provinceName ? regionOf(input.provinceName) : null),
  );
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
    <div className="flex flex-wrap items-end gap-3" aria-busy={isPending}>
      <label className="grid gap-1 text-sm">
        Kỳ
        <select
          className={CONTROL}
          value={input.period}
          onChange={(event) =>
            setParams({
              ky: event.target.value,
              'tu-ngay': null,
              'den-ngay': null,
              vu: null,
              'nien-vu': null,
            })
          }
        >
          {DASHBOARD_PERIODS.map((period) => (
            <option key={period} value={period}>
              {DASHBOARD_PERIOD_LABEL[period]}
            </option>
          ))}
        </select>
      </label>
      {input.period === 'vu' ? (
        <label className="grid gap-1 text-sm">
          Vụ
          <select
            className={CONTROL}
            value={input.seasonId ?? ''}
            onChange={(event) => setParams({ vu: event.target.value || null, 'nien-vu': null })}
          >
            {seasonChoices.map((season) => (
              <option key={season.id} value={season.id}>
                {season.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {input.period === 'vu' && selectedSeason && input.seasonYear !== null ? (
        <label className="grid gap-1 text-sm">
          Niên vụ
          <select
            className={CONTROL}
            value={input.seasonYear}
            onChange={(event) => setParams({ 'nien-vu': event.target.value })}
          >
            {seasonYearOptions(selectedSeason, vietnamToday()).map((year) => (
              <option key={year} value={year}>
                {seasonYearLabel(selectedSeason, year)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
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
