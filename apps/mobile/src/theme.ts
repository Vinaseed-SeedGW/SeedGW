// Giá trị lấy đúng từ .design/seedgw/brand/tokens.css. Component chỉ dùng các hằng này.
export const COLORS = {
  brand: '#005b36',
  brandDark: '#00512d',
  brandSoft: '#e6efeb',
  onBrand: '#ffffff',
  surface: '#ffffff',
  surfaceSubtle: '#f1f2f2',
  border: '#d1d3d4',
  text: '#000000',
  textMuted: '#58595b',
  warning: '#e8b909',
  warningSoft: '#fcf4d3',
  danger: '#b33131',
  dangerSoft: '#f7e6e6',
  // Nền đen mờ dưới dải thông tin trên ảnh, để chữ trắng đọc được cả ngoài nắng.
  scrim: 'rgba(0, 0, 0, 0.6)',
} as const;

export const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

export const FONT = { regular: '400', bold: '700' } as const;

// Chữ phóng theo cỡ chữ của máy tới tối đa 1,6 lần: đủ to cho người lớn tuổi, bố cục vẫn giữ được mọi nút.
// Nhãn trên thanh tab, nút nổi, số đỏ phóng ít hơn vì nằm trong khung cố định.
export const FONT_SCALE = { max: 1.6, compact: 1.3, badge: 1.2 } as const;

// Tên nạp font bằng expo-font ở App.tsx; component chữ trong ./components/text tự chọn theo độ đậm.
export const FONT_FAMILY = {
  regular: 'UTMNeoSansIntel-Regular',
  bold: 'UTMNeoSansIntel-Bold',
} as const;
