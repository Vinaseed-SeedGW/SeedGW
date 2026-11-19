import { StyleSheet, View } from 'react-native';
import { Text } from './text';
import { formatCoord, formatVnDate, formatVnTime } from '../sync/geo';
import { COLORS, FONT } from '../theme';
import { APP_NAME } from '@seedgw/config/brand';

export type StripLocation = { lat: number; lng: number; accuracy: number | null };

type Props = {
  /** Thời điểm in lên ảnh, epoch ms. */
  at: number;
  location: StripLocation | null;
  /** Dòng địa chỉ đã định dạng, hoặc lý do chưa có địa chỉ. */
  address: string;
  /** Bề rộng khung chứa, để cỡ chữ trên khung ngắm và trên ảnh giữ cùng tỉ lệ. */
  width: number;
};

/**
 * Dải thông tin hiện trên khung ngắm và được in lên ảnh.
 * Bản thử R3 dùng giờ trên máy và gọi thẳng Vietmap; M2 đổi sang giờ máy chủ, địa chỉ qua V3, thêm tên nhân viên.
 */
export function WatermarkStrip({ at, location, address, width }: Props) {
  const base = Math.max(12, Math.round(width / 26));
  const textStyle = { fontSize: base, lineHeight: Math.round(base * 1.35) };
  const small = { fontSize: Math.round(base * 0.85), lineHeight: Math.round(base * 1.15) };
  const accuracy = location?.accuracy;

  return (
    <View style={[styles.strip, { padding: Math.round(base * 0.7) }]}>
      <Text
        style={[
          styles.text,
          styles.time,
          { fontSize: base * 1.5, lineHeight: Math.round(base * 1.9) },
        ]}
      >
        {formatVnTime(at)}
        <Text style={[styles.text, textStyle]}>{`   ${formatVnDate(at)}`}</Text>
      </Text>
      <Text style={[styles.text, styles.address, textStyle]}>{address}</Text>
      <Text style={[styles.text, small]}>
        {location
          ? `Toạ độ ${formatCoord(location.lat)}, ${formatCoord(location.lng)}`
          : 'Đang lấy vị trí'}
        {accuracy != null ? `   Sai số ${Math.round(accuracy)} m` : ''}
      </Text>
      <Text style={[styles.text, styles.brand, small]}>{`${APP_NAME}, bản thử R3`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { backgroundColor: COLORS.scrim, width: '100%' },
  text: { color: COLORS.onBrand, fontWeight: FONT.regular },
  time: { fontWeight: FONT.bold },
  address: { fontWeight: FONT.bold },
  brand: { opacity: 0.85 },
});
