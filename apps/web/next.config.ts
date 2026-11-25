import path from 'node:path';
import type { NextConfig } from 'next';

// D6: header bảo mật đặt ngay trong ứng dụng để vẫn có khi máy chủ IT không dùng Caddy.
// Next.js chèn script nội tuyến khi dựng trang nên script-src cần 'unsafe-inline'; bản dev cần thêm
// 'unsafe-eval' cho Fast Refresh. Ảnh check-in mở bằng link ký từ kho ảnh, bản đồ nền lấy từ máy chủ
// bản đồ ngoài, nên img-src nhận https và kho ảnh ở máy dev.
const isDev = process.env.NODE_ENV !== 'production';
const devPhotoOrigin = isDev ? ' http://localhost:9000 http://127.0.0.1:9000' : '';
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https:${devPhotoOrigin}`,
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? ' ws:' : ''}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: CONTENT_SECURITY_POLICY },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Web không cần máy ảnh, micro; vị trí chỉ dùng ở trang đăng ký tuyến (Sắp theo đường gần nhất).
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), payment=()' },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
  // Bản build cho Docker chỉ gồm các file thật sự cần chạy (deploy/docker/Dockerfile).
  output: 'standalone',
  outputFileTracingRoot: path.resolve(process.cwd(), '../..'),
  transpilePackages: ['@seedgw/config', '@seedgw/contracts', '@seedgw/db', '@seedgw/ui'],
  // File đại lý xuất từ hệ thống cũ nặng khoảng 3 MB, giới hạn mặc định của Server Action là 1 MB.
  experimental: { serverActions: { bodySizeLimit: '15mb' } },
  serverExternalPackages: ['@prisma/client', 'argon2', 'exceljs', 'bullmq', 'ioredis'],
  // Node 22 chon file require.mjs cua generator-function, async-function (exceljs keo vao) theo dieu kien
  // module-sync, nhung buoc gom file cua Next bo sot cac file nay nen trang bao 500 tren ban Docker.
  outputFileTracingIncludes: {
    '/**': [
      '../../node_modules/.pnpm/*/node_modules/generator-function/*',
      '../../node_modules/.pnpm/*/node_modules/async-function/*',
    ],
  },
};

export default nextConfig;
