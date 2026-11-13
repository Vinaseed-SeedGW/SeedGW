import { NextResponse } from 'next/server';
import { checkHealth } from '@/server/services/health';

// Trang kiểm tra sức khoẻ cho giám sát và CI/CD (F6). Không cần đăng nhập, không lộ thông tin bí mật.
export const dynamic = 'force-dynamic';

export async function GET() {
  const report = await checkHealth();
  return NextResponse.json(report, {
    status: report.status === 'ok' ? 200 : 503,
    headers: { 'cache-control': 'no-store' },
  });
}
