import 'server-only';
import { reverseGeocode as vietmapReverseGeocode, type GeocodeOutcome } from '@seedgw/db/vietmap';

// Route Handler lấy địa chỉ qua đây; phần gọi Vietmap nằm ở @seedgw/db để worker dùng chung (F8).
export function reverseGeocode(lat: number, lng: number): Promise<GeocodeOutcome> {
  return vietmapReverseGeocode(lat, lng);
}
