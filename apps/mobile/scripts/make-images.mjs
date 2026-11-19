// Tạo ảnh PNG cho app từ SVG thương hiệu và bộ icon lucide của web (M6), vì app chưa vẽ được SVG.
// Chạy lại khi đổi logo hoặc icon: node apps/mobile/scripts/make-images.mjs (từ thư mục gốc repo).
// Logo giữ đúng tỉ lệ gốc, chỉ phóng theo chiều rộng (BRAND.md §1), xuất cỡ gấp 3 cho màn hình nét.
import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const root = process.cwd();
const require = createRequire(path.join(root, 'apps/web/package.json'));
// sharp đi kèm Next.js (tối ưu ảnh), lấy qua Next để không thêm thư viện mới.
const sharp = createRequire(require.resolve('next/package.json'))('sharp');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const lucide = require('lucide-react');

const brand = path.join(root, '.design/seedgw/brand/logo');
const out = path.join(root, 'apps/mobile/assets/images');
mkdirSync(out, { recursive: true });

const BRAND_GREEN = '#005b36';
const SCALE = 3;

async function logo(file, widthPx, name) {
  const svg = readFileSync(path.join(brand, file));
  await sharp(svg, { density: 600 })
    .resize({ width: widthPx * SCALE })
    .png()
    .toFile(path.join(out, name));
}

// Icon tab vẽ màu đen, app tô lại màu bằng tintColor theo tab đang chọn.
async function icon(Component, name) {
  const svg = renderToStaticMarkup(
    React.createElement(Component, { size: 24, color: '#000000', strokeWidth: 2 }),
  );
  await sharp(Buffer.from(svg), { density: 600 })
    .resize({ width: 28 * SCALE, height: 28 * SCALE })
    .png()
    .toFile(path.join(out, name));
}

// Biểu tượng app: nền xanh, biểu tượng Vinaseed trắng chiếm 55% cạnh (BRAND.md: 50-60% cạnh icon).
async function appIcon() {
  const size = 1024;
  const symbolSize = Math.round(size * 0.55);
  const symbol = await sharp(readFileSync(path.join(brand, 'vinaseed-symbol-white.svg')), {
    density: 1200,
  })
    .resize({ width: symbolSize, height: symbolSize, fit: 'contain', background: '#00000000' })
    .png()
    .toBuffer();
  const offset = Math.round((size - symbolSize) / 2);
  await sharp({ create: { width: size, height: size, channels: 4, background: BRAND_GREEN } })
    .composite([{ input: symbol, left: offset, top: offset }])
    .png()
    .toFile(path.join(out, 'app-icon.png'));
  // Android tự cắt tròn hoặc bo góc phần nền, nên ảnh trước nhỏ hơn để nằm trong vùng an toàn.
  const fgSymbolSize = Math.round(size * 0.42);
  const fg = await sharp(readFileSync(path.join(brand, 'vinaseed-symbol-white.svg')), {
    density: 1200,
  })
    .resize({ width: fgSymbolSize, height: fgSymbolSize, fit: 'contain', background: '#00000000' })
    .png()
    .toBuffer();
  const fgOffset = Math.round((size - fgSymbolSize) / 2);
  await sharp({ create: { width: size, height: size, channels: 4, background: '#00000000' } })
    .composite([{ input: fg, left: fgOffset, top: fgOffset }])
    .png()
    .toFile(path.join(out, 'app-icon-foreground.png'));
}

await logo('vinaseed-logo-white.svg', 160, 'logo-white-m.png');
await logo('vinaseed-logo-color.svg', 120, 'logo-color-s.png');
await icon(lucide.House, 'tab-today.png');
await icon(lucide.Route, 'tab-route.png');
await icon(lucide.History, 'tab-history.png');
await icon(lucide.UserRound, 'tab-me.png');
await appIcon();
console.log('Đã tạo ảnh trong apps/mobile/assets/images');
