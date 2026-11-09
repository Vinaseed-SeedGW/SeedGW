import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@dms/config', '@dms/contracts', '@dms/db', '@dms/ui'],
  serverExternalPackages: ['@prisma/client', 'argon2', 'exceljs'],
};

export default nextConfig;
