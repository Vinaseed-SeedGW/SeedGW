import localFont from 'next/font/local';

export const brandFont = localFont({
  variable: '--font-brand',
  display: 'swap',
  adjustFontFallback: false,
  declarations: [
    { prop: 'ascent-override', value: '99%' },
    { prop: 'descent-override', value: '37.7%' },
    { prop: 'line-gap-override', value: '0%' },
  ],
  src: [
    { path: './fonts/UTMNeoSansIntel-Regular.woff2', weight: '400', style: 'normal' },
    { path: './fonts/UTMNeoSansIntel-Italic.woff2', weight: '400', style: 'italic' },
    { path: './fonts/UTMNeoSansIntel-Bold.woff2', weight: '700', style: 'normal' },
    { path: './fonts/UTMNeoSansIntel-BoldItalic.woff2', weight: '700', style: 'italic' },
  ],
});
