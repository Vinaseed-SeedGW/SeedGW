'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import type { DealerDetail, DealerFormOptions } from '@seedgw/contracts/dealers';
import { PROVINCE_MAP_CENTER, type ProvinceName } from '@seedgw/contracts/provinces';
import type { LatLng } from './dealer-location-map';

const DealerLocationMap = dynamic(
  () => import('./dealer-location-map').then((module) => module.DealerLocationMap),
  {
    ssr: false,
    loading: () => <div className="h-72 w-full animate-pulse rounded-md bg-surface-subtle" />,
  },
);

const HANOI = PROVINCE_MAP_CENTER['Thành phố Hà Nội'];

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Mở bản đồ ở toạ độ hiện có; chưa có thì ở lần check-in gần nhất tại đại lý; chưa có nữa thì ở trung tâm
 * tỉnh của đại lý; chưa có tỉnh thì ở Hà Nội (duyệt 18/11/2026).
 */
function startView(
  dealer: StartPoint,
  province: string | null,
): { center: LatLng; zoom: number; source: string } {
  if (dealer.lat !== null && dealer.lng !== null) {
    return { center: { lat: dealer.lat, lng: dealer.lng }, zoom: 17, source: 'toạ độ hiện có' };
  }
  if (dealer.lastCheckInPoint) {
    return {
      center: dealer.lastCheckInPoint,
      zoom: 17,
      source: 'lần check-in gần nhất tại đại lý',
    };
  }
  const center = province ? PROVINCE_MAP_CENTER[province as ProvinceName] : undefined;
  if (center) return { center, zoom: 12, source: 'trung tâm tỉnh của đại lý' };
  return { center: HANOI, zoom: 11, source: 'Hà Nội vì đại lý chưa có tỉnh' };
}

/** Điểm mở bản đồ: đại lý đang sửa, hoặc đại lý mới (chưa có gì) ở form Thêm đại lý. */
type StartPoint = Pick<DealerDetail, 'lat' | 'lng' | 'lastCheckInPoint' | 'provinceName'>;

type Props = { dealer: StartPoint; tiles: DealerFormOptions['mapTiles'] };

/** Chọn toạ độ trên bản đồ, ghi vào hai ô Vĩ độ, Kinh độ của form sửa đại lý (A7b). */
export function DealerLocationPicker({ dealer, tiles }: Props) {
  const { setValue, getValues, control } = useFormContext<{
    lat: unknown;
    lng: unknown;
    provinceName?: string | null;
  }>();
  const [lat, lng] = useWatch({ control, name: ['lat', 'lng'] });
  const [view, setView] = useState<ReturnType<typeof startView> | null>(null);
  const latValue = toNumber(lat);
  const lngValue = toNumber(lng);
  const value = latValue !== null && lngValue !== null ? { lat: latValue, lng: lngValue } : null;

  function pick(point: LatLng) {
    setValue('lat', point.lat.toFixed(6), { shouldDirty: true, shouldValidate: true });
    setValue('lng', point.lng.toFixed(6), { shouldDirty: true, shouldValidate: true });
  }

  return (
    <div className="mt-3.5">
      {view ? (
        <>
          <p className="mb-1 text-sm text-text-muted">
            Bản đồ mở ở {view.source}. Phóng to, bấm đúng vị trí cửa hàng hoặc kéo ghim, rồi bấm Lưu
            ở cuối form.
          </p>
          <DealerLocationMap
            tiles={tiles}
            center={view.center}
            zoom={view.zoom}
            value={value}
            onPick={pick}
          />
        </>
      ) : (
        <button
          type="button"
          onClick={() =>
            setView(startView(dealer, getValues('provinceName') ?? dealer.provinceName))
          }
          className="inline-flex h-9.5 items-center rounded-md border border-border bg-surface px-3 font-bold hover:bg-brand-soft"
        >
          Chọn toạ độ trên bản đồ
        </button>
      )}
    </div>
  );
}
