'use client';

import dynamic from 'next/dynamic';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  CHECK_IN_FLAG_LABEL,
  CHECK_IN_PLACE_KIND_LABEL,
  dayMapLegText,
  formatKm,
  type DayMapCheckIn,
  type DayMapFilterOptions,
  type DayMapInput,
  type DayMapResult,
} from '@dms/contracts/check-ins';
import { formatDateTime, isoDateToDisplay } from '@dms/contracts/format';
import { DateInput } from '@dms/ui/date-input';
import { useModalDialog } from '@dms/ui/use-modal-dialog';
import type { MapTiles } from './day-map-canvas';

// Bản đồ chỉ tải khi mở tab Bản đồ (AGENTS.md §9), không làm nặng tab Danh sách.
const DayMapCanvas = dynamic(() => import('./day-map-canvas').then((mod) => mod.DayMapCanvas), {
  ssr: false,
  loading: () => (
    <div className="h-[60vh] min-h-80 w-full animate-pulse rounded-md bg-surface-subtle lg:h-[560px]" />
  ),
});

const CONTROL = 'h-9.5 rounded-md border border-border bg-surface px-2.5';
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function timeOf(iso: string): string {
  return formatDateTime(iso).slice(-5);
}

type Props = {
  input: DayMapInput;
  options: DayMapFilterOptions;
  data: DayMapResult | null;
  tiles: MapTiles;
};

export function DayMapView({ input, options, data, tiles }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [photo, setPhoto] = useState<DayMapCheckIn | null>(null);

  function setParams(updates: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    next.set('tab', 'ban-do');
    for (const [key, value] of Object.entries(updates)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setFocusedId(null);
    startTransition(() => router.push(`${pathname}?${next.toString()}`));
  }

  const hasTrip = data !== null && (data.lines.length > 0 || data.checkIns.length > 0);

  return (
    <div className="mt-4 grid gap-4" aria-busy={isPending}>
      <div className="flex flex-wrap items-end gap-3">
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
        <label className="grid gap-1 text-sm">
          Nhân viên
          <select
            className={`${CONTROL} max-w-80`}
            value={input.employeeCode ?? ''}
            onChange={(event) => setParams({ 'nhan-vien': event.target.value || null })}
          >
            <option value="">Chọn nhân viên</option>
            {options.employees.map((employee) => (
              <option key={employee.code} value={employee.code}>
                {employee.code}, {employee.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Ngày
          <DateInput
            className="w-40"
            inputClassName={CONTROL}
            value={input.day}
            onValueChange={(value) => {
              if (ISO_DATE.test(value)) setParams({ ngay: isoDateToDisplay(value) });
            }}
          />
        </label>
      </div>

      {!input.employeeCode ? (
        <p className="text-text-muted">Chọn nhân viên để xem hành trình trong ngày.</p>
      ) : data === null ? (
        <p className="text-danger">
          Không tìm thấy nhân viên {input.employeeCode} trong phạm vi bạn được xem.
        </p>
      ) : !hasTrip ? (
        <p className="text-text-muted">
          Không có hành trình ngày {isoDateToDisplay(data.day)} của {data.employee.name}.
        </p>
      ) : (
        <>
          <Summary data={data} />
          {!data.trackAvailable ? (
            <p className="rounded-md bg-warning-soft px-3 py-2">
              Vết GPS chỉ giữ 45 ngày nên ngày này chỉ còn các điểm check-in. Km giữa các lượt vẫn
              giữ 18 tháng.
            </p>
          ) : null}
          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <DayMapCanvas
              data={data}
              tiles={tiles}
              focusedId={focusedId}
              onSelect={setFocusedId}
              onViewPhoto={setPhoto}
            />
            <ol className="grid content-start gap-2" aria-label="Các lượt check-in trong ngày">
              {data.checkIns.length === 0 ? (
                <li className="text-text-muted">Ngày này có ghi hành trình nhưng chưa check-in.</li>
              ) : null}
              {data.checkIns.map((checkIn) => (
                <li key={checkIn.id}>
                  <button
                    type="button"
                    onClick={() => setFocusedId(checkIn.id)}
                    aria-current={focusedId === checkIn.id ? 'true' : undefined}
                    className={`grid w-full gap-0.5 rounded-md border px-3 py-2 text-left hover:bg-brand-soft ${
                      focusedId === checkIn.id ? 'border-brand bg-brand-soft' : 'border-border'
                    }`}
                  >
                    <span className="font-bold">
                      {checkIn.order}. {timeOf(checkIn.capturedAt)} {checkIn.placeName}
                      {checkIn.placeKind === 'DEALER'
                        ? ''
                        : `, ${CHECK_IN_PLACE_KIND_LABEL[checkIn.placeKind]}`}
                    </span>
                    <span className="text-sm text-text-muted">{dayMapLegText(checkIn)}</span>
                    {checkIn.flags.length > 0 ? (
                      <span className="text-sm">
                        {checkIn.flags.map((flag) => CHECK_IN_FLAG_LABEL[flag]).join(', ')}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </>
      )}
      {photo ? <PhotoDialog checkIn={photo} onClose={() => setPhoto(null)} /> : null}
    </div>
  );
}

function Summary({ data }: { data: DayMapResult }) {
  const items = [
    { label: 'Nhân viên', value: `${data.employee.code}, ${data.employee.name}` },
    { label: 'Lượt check-in', value: String(data.checkIns.length) },
    ...(data.roadKm === null
      ? []
      : [{ label: 'Km theo đường giữa các lượt', value: formatKm(data.roadKm) }]),
    { label: 'Km theo GPS giữa các lượt', value: formatKm(data.checkInKm) },
    {
      label: 'Km theo GPS cả ngày',
      value: data.trackAvailable ? formatKm(data.trackKm) : 'Không còn vết',
    },
    {
      label: 'Ghi hành trình',
      value:
        data.start && data.end ? `${timeOf(data.start.at)} tới ${timeOf(data.end.at)}` : 'Không có',
    },
    { label: 'Đoạn đứt', value: String(data.gaps.length) },
  ];
  return (
    <dl
      className={`grid grid-cols-2 gap-3 rounded-md border border-border p-3 sm:grid-cols-3 ${
        items.length > 6 ? 'sm:grid-cols-4 xl:grid-cols-7' : 'xl:grid-cols-6'
      }`}
    >
      {items.map((item) => (
        <div key={item.label} className="grid gap-0.5">
          <dt className="text-sm text-text-muted">{item.label}</dt>
          <dd className="font-bold">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function PhotoDialog({ checkIn, onClose }: { checkIn: DayMapCheckIn; onClose: () => void }) {
  const { dialogRef, attachDialog } = useModalDialog();
  const title = `Ảnh check-in ${checkIn.order}. ${checkIn.placeName}`;
  return (
    <dialog
      ref={attachDialog}
      aria-label={title}
      onClose={onClose}
      className="m-auto w-full max-w-lg rounded-md bg-surface p-4 text-text backdrop:bg-(--overlay)"
    >
      <h2 className="text-lg font-bold text-brand">{title}</h2>
      <p className="text-text-muted">{formatDateTime(checkIn.capturedAt)}</p>
      {checkIn.photoUrl ? (
        // Ảnh tải thẳng từ kho ảnh bằng link có hạn, không qua bộ tối ưu ảnh của Next.
        <img
          src={checkIn.photoUrl}
          alt={`Ảnh check-in lúc ${formatDateTime(checkIn.capturedAt)} tại ${checkIn.placeName}`}
          className="mt-3 max-h-[70vh] w-full rounded-md object-contain"
        />
      ) : null}
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          className="h-9 rounded-md bg-brand px-4 font-bold text-primary-foreground hover:bg-brand-hover"
        >
          Đóng
        </button>
      </div>
    </dialog>
  );
}
