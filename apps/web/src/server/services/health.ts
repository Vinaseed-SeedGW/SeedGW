import 'server-only';
import { db } from '@dms/db/client';
import { pingStorage } from '@/server/integrations/object-storage';

export type HealthReport = {
  status: 'ok' | 'degraded';
  version: string;
  checks: { database: boolean; storage: boolean };
  time: string;
};

async function pingDatabase(): Promise<boolean> {
  try {
    await db.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

/** Dùng cho giám sát và bước kiểm tra sau triển khai. Không trả thông tin bí mật. */
export async function checkHealth(): Promise<HealthReport> {
  const [database, storage] = await Promise.all([pingDatabase(), pingStorage()]);
  return {
    status: database && storage ? 'ok' : 'degraded',
    version: process.env.APP_VERSION || 'dev',
    checks: { database, storage },
    time: new Date().toISOString(),
  };
}
