import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Bản build cho Docker chỉ gồm các file thật sự cần chạy (deploy/docker/Dockerfile).
  output: 'standalone',
  outputFileTracingRoot: path.resolve(process.cwd(), '../..'),
  transpilePackages: ['@dms/config', '@dms/contracts', '@dms/db', '@dms/ui'],
  // File đại lý xuất từ DMS cũ nặng khoảng 3 MB, giới hạn mặc định của Server Action là 1 MB.
  experimental: { serverActions: { bodySizeLimit: '15mb' } },
  serverExternalPackages: ['@prisma/client', 'argon2', 'exceljs'],
};

export default nextConfig;
