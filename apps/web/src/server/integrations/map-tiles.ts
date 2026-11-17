import 'server-only';

// Bản đồ nền của trang Bản đồ hành trình (V2b). Tạm dùng OpenStreetMap cho buổi demo (chốt 17/11/2026)
// vì khoá Vietmap hiện chưa mở dịch vụ bản đồ. Có gói bản đồ Vietmap thì đặt MAP_TILE_URL, ví dụ
// https://maps.vietmap.vn/api/tm/{z}/{x}/{y}@2x.png?apikey={apikey}; {apikey} lấy từ MAP_TILE_API_KEY.
const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION = 'Bản đồ © OpenStreetMap';

export type MapTileConfig = { url: string; attribution: string; maxZoom: number };

export function mapTileConfig(): MapTileConfig {
  const custom = process.env.MAP_TILE_URL?.trim();
  if (!custom) return { url: OSM_TILE_URL, attribution: OSM_ATTRIBUTION, maxZoom: 19 };
  const key = process.env.MAP_TILE_API_KEY?.trim() ?? '';
  return {
    url: custom.replace('{apikey}', encodeURIComponent(key)),
    attribution: process.env.MAP_TILE_ATTRIBUTION?.trim() || 'Bản đồ © Vietmap',
    maxZoom: 18,
  };
}
