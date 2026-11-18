import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Bản build cho Docker chỉ gồm các file thật sự cần chạy (deploy/docker/Dockerfile).
  output: 'standalone',
  outputFileTracingRoot: path.resolve(process.cwd(), '../..'),
  transpilePackages: ['@dms/config', '@dms/contracts', '@dms/db', '@dms/ui'],
  // File đại lý xuất từ DMS cũ nặng khoảng 3 MB, giới hạn mặc định của Server Action là 1 MB.
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
