'use client';

import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useRef } from 'react';
import {
  CHECK_IN_FLAG_LABEL,
  dayMapLegText,
  type DayMapCheckIn,
  type DayMapResult,
} from '@dms/contracts/check-ins';
import { formatDateTime, formatNumber } from '@dms/contracts/format';

export type MapTiles = { url: string; attribution: string; maxZoom: number };

type Props = {
  data: DayMapResult;
  tiles: MapTiles;
  focusedId: string | null;
  onSelect: (id: string) => void;
  onViewPhoto: (checkIn: DayMapCheckIn) => void;
};

// Màu lấy từ token của dự án lúc chạy, không viết mã màu trong component (BRAND.md).
function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  // Tên điểm, địa chỉ, lý do do nhân viên nhập: gán textContent để không chạy được mã lạ.
  if (text !== undefined) node.textContent = text;
  return node;
}

function popupContent(checkIn: DayMapCheckIn, onViewPhoto: () => void): HTMLElement {
  const root = element('div', 'grid gap-1 text-sm');
  root.append(
    element('strong', 'text-base text-brand', `${checkIn.order}. ${checkIn.placeName}`),
    element('span', '', formatDateTime(checkIn.capturedAt)),
  );
  if (checkIn.address) root.append(element('span', 'text-text-muted', checkIn.address));
  root.append(element('span', '', dayMapLegText(checkIn)));
  for (const flag of checkIn.flags) {
    const extra =
      flag === 'FAR_FROM_DEALER' && checkIn.dealerDistanceM !== null
        ? `, cách ${formatNumber(Math.round(checkIn.dealerDistanceM))} m`
        : '';
    root.append(
      element(
        'span',
        'justify-self-start rounded-sm bg-warning-soft px-1.5',
        `${CHECK_IN_FLAG_LABEL[flag]}${extra}`,
      ),
    );
  }
  if (checkIn.farReason) root.append(element('span', '', `Lý do: ${checkIn.farReason}`));
  if (checkIn.photoUrl) {
    const button = element('button', 'justify-self-start font-bold text-brand', 'Xem ảnh');
    button.type = 'button';
    button.addEventListener('click', onViewPhoto);
    root.append(button);
  }
  return root;
}

function numberIcon(order: number, focused: boolean): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<span class="grid size-7 place-items-center rounded-full border-2 border-surface font-bold text-sm shadow ${
      focused ? 'bg-warning text-text' : 'bg-brand text-primary-foreground'
    }">${order}</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}

function pinIcon(label: string, className: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<span class="whitespace-nowrap rounded-sm px-1.5 py-0.5 text-xs font-bold shadow ${className}">${label}</span>`,
    iconSize: [0, 0],
    iconAnchor: [0, 24],
  });
}

/** Bản đồ hành trình một ngày (V2b), dùng leaflet trực tiếp, không qua react-leaflet. */
export function DayMapCanvas({ data, tiles, focusedId, onSelect, onViewPhoto }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef(new Map<string, L.Marker>());
  const callbacks = useRef({ onSelect, onViewPhoto });
  callbacks.current = { onSelect, onViewPhoto };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const map = L.map(container, { zoomControl: true, attributionControl: true });
    mapRef.current = map;
    L.tileLayer(tiles.url, { attribution: tiles.attribution, maxZoom: tiles.maxZoom }).addTo(map);

    const brand = token('--brand');
    const muted = token('--text-muted');
    const warning = token('--warning');
    const bounds = L.latLngBounds([]);

    for (const line of data.lines) {
      L.polyline(line, { color: brand, weight: 4, opacity: 0.85 }).addTo(map);
      for (const point of line) bounds.extend(point);
    }
    for (const gap of data.gaps) {
      L.polyline(gap, { color: muted, weight: 3, dashArray: '6 8' })
        .bindTooltip('Đoạn đứt: app tắt hoặc mất GPS')
        .addTo(map);
    }
    if (data.start) {
      L.marker(data.start.point, {
        icon: pinIcon('Bắt đầu', 'bg-surface text-brand'),
        keyboard: false,
      }).addTo(map);
    }
    if (data.end) {
      L.marker(data.end.point, {
        icon: pinIcon('Kết thúc', 'bg-surface text-text'),
        keyboard: false,
      }).addTo(map);
    }

    markersRef.current.clear();
    for (const checkIn of data.checkIns) {
      const point: [number, number] = [checkIn.lat, checkIn.lng];
      bounds.extend(point);
      const marker = L.marker(point, {
        icon: numberIcon(checkIn.order, false),
        title: `${checkIn.order}. ${checkIn.placeName}`,
      })
        .bindPopup(() => popupContent(checkIn, () => callbacks.current.onViewPhoto(checkIn)))
        .on('click', () => callbacks.current.onSelect(checkIn.id))
        .addTo(map);
      markersRef.current.set(checkIn.id, marker);
      // Bị cờ Xa đại lý: nối điểm chụp với toạ độ đã duyệt của đại lý để thấy lệch bao xa.
      if (checkIn.dealer && checkIn.flags.includes('FAR_FROM_DEALER')) {
        const dealerPoint: [number, number] = [checkIn.dealer.lat, checkIn.dealer.lng];
        L.polyline([point, dealerPoint], { color: warning, weight: 3, dashArray: '2 6' }).addTo(
          map,
        );
        L.circleMarker(dealerPoint, { radius: 6, color: warning, fillOpacity: 0.9 })
          .bindTooltip(`Toạ độ đại lý ${checkIn.dealer.name}`)
          .addTo(map);
        bounds.extend(dealerPoint);
      }
    }

    if (bounds.isValid()) map.fitBounds(bounds, { padding: [32, 32], maxZoom: 17 });
    else map.setView([21.0285, 105.8542], 12);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [data, tiles]);

  // Bấm một lượt trong danh sách: bản đồ chạy tới điểm đó và mở thông tin.
  useEffect(() => {
    for (const [id, marker] of markersRef.current) {
      const checkIn = data.checkIns.find((item) => item.id === id);
      if (checkIn) marker.setIcon(numberIcon(checkIn.order, id === focusedId));
    }
    if (!focusedId) return;
    const marker = markersRef.current.get(focusedId);
    const map = mapRef.current;
    if (marker && map) {
      map.setView(marker.getLatLng(), Math.max(map.getZoom(), 16));
      marker.openPopup();
    }
  }, [focusedId, data]);

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label={`Bản đồ hành trình của ${data.employee.name}`}
      className="isolate h-[60vh] min-h-80 w-full rounded-md border border-border lg:h-[560px]"
    />
  );
}
