'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import {
  formatRouteDay,
  formatRouteDayShort,
  MAX_STOPS_PER_DAY,
  sortByNearest,
  submitRoutePlanInput,
  type MyRoutePeriod,
  type RouteDealerOption,
} from '@dms/contracts/route-plans';
import { useToast } from '@dms/ui/toast';
import { searchRouteDealersAction, submitRoutePlanAction } from '@/server/actions/route-plans';

type Stop = Pick<RouteDealerOption, 'id' | 'name' | 'code' | 'address' | 'lat' | 'lng'>;

const PRIMARY =
  'inline-flex h-9.5 items-center rounded-md bg-brand px-4 font-bold text-primary-foreground hover:bg-brand-hover disabled:opacity-70';
const SECONDARY =
  'inline-flex h-9.5 items-center rounded-md border border-border bg-surface px-3 font-bold hover:bg-brand-soft disabled:opacity-50';
const SMALL =
  'inline-flex h-8 items-center rounded-md border border-border bg-surface px-2 text-sm font-bold text-brand hover:bg-brand-soft disabled:opacity-40';
const SEARCH_DELAY_MS = 300;

function initialDays(period: MyRoutePeriod): Record<string, Stop[]> {
  const days: Record<string, Stop[]> = {};
  for (const day of period.days) days[day] = [];
  for (const day of period.plan?.proposed ?? []) {
    days[day.day] = day.stops.map((stop) => ({
      id: stop.dealerId,
      name: stop.dealerName,
      code: stop.dealerCode,
      address: stop.address,
      lat: stop.lat,
      lng: stop.lng,
    }));
  }
  return days;
}

function currentPosition(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => resolve(null),
      { timeout: 5000, maximumAge: 300_000 },
    );
  });
}

type Props = {
  period: MyRoutePeriod;
  /** null là tuyến của chính mình; có giá trị khi Quản trị hệ thống đăng ký thay. */
  ownerId: string | null;
  backHref: string;
};

/** Đăng ký hoặc sửa tuyến trên web, cùng quy tắc với app (S8). */
export function RouteEditor({ period, ownerId, backHref }: Props) {
  const router = useRouter();
  const { actions: toast } = useToast();
  const [days, setDays] = useState(() => initialDays(period));
  const [day, setDay] = useState(period.days[0] ?? period.periodStart);
  const [note, setNote] = useState(period.plan?.note ?? '');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RouteDealerOption[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSearching, startSearch] = useTransition();
  const [isSaving, startSave] = useTransition();
  const stops = days[day] ?? [];

  useEffect(() => {
    const timer = setTimeout(() => {
      startSearch(async () => {
        const result = await searchRouteDealersAction({ q: query });
        if (result.ok) {
          setResults(result.data);
          setSearchError(null);
        } else {
          setSearchError(result.message);
        }
      });
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [query]);

  function update(next: Stop[]) {
    setDays((current) => ({ ...current, [day]: next }));
  }

  function add(dealer: RouteDealerOption) {
    if (stops.some((stop) => stop.id === dealer.id)) {
      setError(`${dealer.name} đã có trong ${formatRouteDay(day)}`);
      return;
    }
    if (stops.length >= MAX_STOPS_PER_DAY) {
      setError(`Tối đa ${MAX_STOPS_PER_DAY} điểm mỗi ngày`);
      return;
    }
    setError(null);
    update([...stops, dealer]);
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= stops.length) return;
    const next = [...stops];
    const [item] = next.splice(index, 1);
    if (item) next.splice(target, 0, item);
    update(next);
  }

  async function sortNearest() {
    update(sortByNearest(stops, await currentPosition()));
  }

  function submit() {
    const parsed = submitRoutePlanInput.safeParse({
      kind: period.kind,
      periodStart: period.periodStart,
      days: period.days.map((item) => ({
        day: item,
        dealerIds: (days[item] ?? []).map((stop) => stop.id),
      })),
      note,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Kiểm tra lại tuyến');
      return;
    }
    setError(null);
    startSave(async () => {
      const result = await submitRoutePlanAction(parsed.data, ownerId);
      if (!result.ok) {
        setError(
          result.fieldErrors
            ? (Object.values(result.fieldErrors)[0] ?? result.message)
            : result.message,
        );
        return;
      }
      toast.show({
        tone: 'success',
        message: result.data.selfApproved
          ? `Đã lưu tuyến, phiếu ${result.data.code} tự duyệt`
          : `Đã gửi duyệt phiếu ${result.data.code}`,
      });
      result.warnings?.forEach(({ message }) => toast.show({ tone: 'warning', message }));
      router.push(backHref);
      router.refresh();
    });
  }

  return (
    <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
      <section aria-labelledby="route-days-title" className="min-w-0">
        <h2 id="route-days-title" className="sr-only">
          Các ngày trong tuyến
        </h2>
        {period.days.length > 1 ? (
          <div role="tablist" aria-label="Chọn ngày" className="flex flex-wrap gap-2">
            {period.days.map((item) => {
              const selected = item === day;
              return (
                <button
                  key={item}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => {
                    setDay(item);
                    setError(null);
                  }}
                  className={`h-9.5 rounded-md border px-3 ${selected ? 'border-brand bg-brand-soft font-bold text-brand' : 'border-border bg-surface hover:bg-brand-soft'}`}
                >
                  {formatRouteDayShort(item)} ({days[item]?.length ?? 0})
                </button>
              );
            })}
          </div>
        ) : null}

        <h3 className="mt-4 font-bold">
          {formatRouteDay(day)}
          <span className="ml-2 text-sm font-normal text-text-muted">
            {stops.length} trên tối đa {MAX_STOPS_PER_DAY} điểm
          </span>
        </h3>
        {stops.length === 0 ? (
          <p className="mt-2 text-text-muted">
            Chưa có điểm. Tìm đại lý ở cột bên và bấm Thêm; ngày không đi tuyến thì để trống.
          </p>
        ) : (
          <ol className="mt-2 grid gap-2">
            {stops.map((stop, index) => (
              <li
                key={stop.id}
                className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2"
              >
                <span className="w-6 text-right font-bold text-text-muted">{index + 1}.</span>
                <span className="min-w-0 flex-1">
                  <span className="font-bold">{stop.name}</span>
                  {stop.code ? (
                    <span className="text-sm text-text-muted"> ({stop.code})</span>
                  ) : null}
                  <span className="block text-sm text-text-muted">
                    {stop.address}
                    {stop.lat === null ? ', chưa có toạ độ' : ''}
                  </span>
                </span>
                <span className="flex gap-1">
                  <button
                    type="button"
                    className={SMALL}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    aria-label={`Đưa ${stop.name} lên trước`}
                  >
                    Lên
                  </button>
                  <button
                    type="button"
                    className={SMALL}
                    disabled={index === stops.length - 1}
                    onClick={() => move(index, 1)}
                    aria-label={`Đưa ${stop.name} xuống sau`}
                  >
                    Xuống
                  </button>
                  <button
                    type="button"
                    className={SMALL}
                    onClick={() => update(stops.filter((_, i) => i !== index))}
                    aria-label={`Bỏ ${stop.name} khỏi tuyến`}
                  >
                    Bỏ
                  </button>
                </span>
              </li>
            ))}
          </ol>
        )}
        {stops.length > 1 ? (
          <button type="button" className={`${SECONDARY} mt-3`} onClick={() => void sortNearest()}>
            Sắp theo đường gần nhất
          </button>
        ) : null}

        <label className="mt-5 block font-bold" htmlFor="route-note">
          Ghi chú cho người duyệt (không bắt buộc)
        </label>
        <textarea
          id="route-note"
          value={note}
          maxLength={500}
          onChange={(event) => setNote(event.target.value)}
          className="mt-1 min-h-20 w-full rounded-md border border-border bg-surface p-2"
        />
        {error ? (
          <p role="alert" className="mt-3 rounded-md bg-danger-soft px-2.5 py-2 text-danger">
            {error}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className={PRIMARY} disabled={isSaving} onClick={submit}>
            {isSaving ? 'Đang gửi...' : 'Gửi duyệt'}
          </button>
          <button type="button" className={SECONDARY} onClick={() => router.push(backHref)}>
            Huỷ
          </button>
        </div>
      </section>

      <section aria-labelledby="route-search-title" className="min-w-0">
        <h2 id="route-search-title" className="font-bold">
          Thêm đại lý vào {formatRouteDay(day)}
        </h2>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Tìm theo tên, mã, số điện thoại"
          aria-label="Tìm đại lý"
          className="mt-2 h-9.5 w-full rounded-md border border-input bg-surface px-2.5"
        />
        <div aria-live="polite" aria-busy={isSearching} className="mt-2 grid gap-1">
          {searchError ? <p className="text-danger">{searchError}</p> : null}
          {!searchError && results.length === 0 && !isSearching ? (
            <p className="text-text-muted">Không tìm thấy đại lý trong phạm vi.</p>
          ) : null}
          {results.map((dealer) => {
            const added = stops.some((stop) => stop.id === dealer.id);
            return (
              <div
                key={dealer.id}
                className="flex items-center gap-2 border-b border-border py-1.5"
              >
                <span className="min-w-0 flex-1">
                  <span className="font-bold">{dealer.name}</span>
                  {dealer.code ? (
                    <span className="text-sm text-text-muted"> ({dealer.code})</span>
                  ) : null}
                  <span className="block truncate text-sm text-text-muted">{dealer.address}</span>
                </span>
                <button
                  type="button"
                  className={SMALL}
                  disabled={added}
                  onClick={() => add(dealer)}
                  aria-label={`Thêm ${dealer.name}`}
                >
                  {added ? 'Đã thêm' : 'Thêm'}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
