import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Bản build cho Docker chỉ gồm các file thật sự cần chạy (deploy/docker/Dockerfile).
  output: 'standalone',
  outputFileTracingRoot: path.resolve(process.cwd(), '../..'),
  transpilePackages: ['@dms/config', '@dms/contracts', '@dms/db', '@dms/ui'],
  serverExternalPackages: ['@prisma/client', 'argon2', 'exceljs'],
};

export default nextConfig;
