'use client';

import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useRef } from 'react';

export type LatLng = { lat: number; lng: number };
type Tiles = { url: string; attribution: string; maxZoom: number };

type Props = {
  tiles: Tiles;
  center: LatLng;
  zoom: number;
  value: LatLng | null;
  onPick: (point: LatLng) => void;
};

// Ghim vẽ bằng lớp CSS dùng token, không dùng ảnh mặc định của Leaflet (BRAND.md: chỉ màu token).
const PIN = L.divIcon({
  className: '',
  html: '<span class="block size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-brand shadow"></span>',
  iconSize: [0, 0],
});

/** Bản đồ chọn toạ độ đại lý (A7b): bấm vào bản đồ hoặc kéo ghim. Tải bằng next/dynamic. */
export function DealerLocationMap({ tiles, center, zoom, value, onPick }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const pick = useRef(onPick);
  pick.current = onPick;

  useEffect(() => {
    if (!box.current || map.current) return;
    const instance = L.map(box.current, { center: [center.lat, center.lng], zoom });
    L.tileLayer(tiles.url, { attribution: tiles.attribution, maxZoom: tiles.maxZoom }).addTo(
      instance,
    );
    instance.on('click', (event: L.LeafletMouseEvent) =>
      pick.current({ lat: event.latlng.lat, lng: event.latlng.lng }),
    );
    map.current = instance;
    return () => {
      instance.remove();
      map.current = null;
      marker.current = null;
    };
    // Chỉ dựng bản đồ một lần; tâm ban đầu không đổi theo giá trị đang chọn.
  }, []);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    if (!value) {
      marker.current?.remove();
      marker.current = null;
      return;
    }
    if (!marker.current) {
      marker.current = L.marker([value.lat, value.lng], {
        icon: PIN,
        draggable: true,
        keyboard: false,
      })
        .addTo(instance)
        .on('dragend', (event) => {
          const position = (event.target as L.Marker).getLatLng();
          pick.current({ lat: position.lat, lng: position.lng });
        });
    } else {
      marker.current.setLatLng([value.lat, value.lng]);
    }
  }, [value]);

  return (
    <div
      ref={box}
      role="application"
      aria-label="Bản đồ chọn toạ độ đại lý. Bấm vào vị trí đại lý hoặc kéo ghim."
      className="h-72 w-full rounded-md border border-border"
    />
  );
}
