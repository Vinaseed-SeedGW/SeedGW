import 'server-only';
import { auditChanges, type AuditChanges } from '@seedgw/contracts/audit';
import {
  FastApiError,
  fastLogin,
  type FastConfig,
  type FastConnectionView,
  type FastOverview,
  type SaveFastConnectionInput,
} from '@seedgw/contracts/fast';
import { resolveSystemSettings } from '@seedgw/contracts/settings';
import { db } from '@seedgw/db/client';
import {
  IntegrationKeyMissingError,
  readFastConfig,
  writeFastConfig,
} from '@seedgw/db/integration-settings';
import { DomainError } from './domain-error';

// Trang Kết nối FAST (A8). Mật khẩu không bao giờ trả về trình duyệt, chỉ báo đã lưu hay chưa.

async function loadConfig(): Promise<{ config: FastConfig; updatedAt: Date } | null> {
  try {
    return await readFastConfig();
  } catch (error) {
    if (error instanceof IntegrationKeyMissingError)
      throw new DomainError('INTEGRATION', error.message);
    throw new DomainError('INTEGRATION', 'Không đọc được cấu hình FAST đã lưu, vui lòng nhập lại');
  }
}

function connectionView(
  stored: { config: FastConfig; updatedAt: Date } | null,
): FastConnectionView {
  return {
    configured: stored !== null,
    enabled: stored?.config.enabled ?? false,
    baseUrl: stored?.config.baseUrl ?? '',
    username: stored?.config.username ?? '',
    passwordSet: Boolean(stored?.config.password),
    updatedAt: stored?.updatedAt.toISOString() ?? null,
  };
}

export async function readFastOverview(): Promise<FastOverview> {
  const [stored, setting, runs, lastFull, fastCustomers, matchedDealers, dealersWithCode] =
    await Promise.all([
      loadConfig().catch(() => null),
      db.systemSetting.findUnique({ where: { key: 'general' }, select: { value: true } }),
      db.fastSyncRun.findMany({ orderBy: { startedAt: 'desc' }, take: 15 }),
      db.fastSyncRun.findFirst({
        where: { status: 'OK', sinceAt: null },
        orderBy: { startedAt: 'desc' },
        select: { startedAt: true },
      }),
      db.fastCustomer.count(),
      db.fastCustomer.count({ where: { dealerId: { not: null } } }),
      db.dealer.count({ where: { code: { not: null } } }),
    ]);
  const latestRunId = runs.find((run) => run.failed > 0)?.id;
  const [errors, notOnFast] = await Promise.all([
    latestRunId
      ? db.fastSyncError.findMany({
          where: { runId: latestRunId },
          orderBy: { createdAt: 'asc' },
          take: 50,
        })
      : [],
    // Chỉ đếm khi đã lấy toàn bộ ít nhất một lần, trước đó chưa biết đại lý nào không có trên FAST.
    lastFull
      ? db.dealer.count({ where: { code: { not: null }, fastCustomer: { is: null } } })
      : null,
  ]);
  return {
    connection: connectionView(stored),
    syncMinutes: resolveSystemSettings(setting?.value).fastCatalogSyncMinutes,
    runs: runs.map((run) => ({
      id: run.id,
      trigger: run.trigger,
      status: run.status,
      sinceAt: run.sinceAt?.toISOString() ?? null,
      fetched: run.fetched,
      created: run.created,
      updated: run.updated,
      unchanged: run.unchanged,
      failed: run.failed,
      message: run.message,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString() ?? null,
    })),
    errors: errors.map((error) => ({
      id: error.id,
      fastCode: error.fastCode,
      message: error.message,
      createdAt: error.createdAt.toISOString(),
    })),
    stats: {
      fastCustomers,
      matchedDealers,
      dealersWithCode,
      dealersNotOnFast: notOnFast,
      lastFullSyncAt: lastFull?.startedAt.toISOString() ?? null,
    },
  };
}

/** Lưu cấu hình; ô mật khẩu để trống thì giữ mật khẩu cũ. Trả phần đổi để ghi nhật ký (không có mật khẩu). */
export async function saveFastConnection(
  actorId: string,
  input: SaveFastConnectionInput,
): Promise<{ id: string; changes: AuditChanges }> {
  const current = await loadConfig().catch(() => null);
  const password = input.password || current?.config.password || '';
  if (!password) {
    throw new DomainError('VALIDATION', 'Nhập mật khẩu API', { password: 'Nhập mật khẩu API' });
  }
  const next: FastConfig = {
    baseUrl: input.baseUrl.replace(/\/+$/, ''),
    username: input.username,
    password,
    enabled: input.enabled,
  };
  try {
    await writeFastConfig(next, actorId);
  } catch (error) {
    if (error instanceof IntegrationKeyMissingError)
      throw new DomainError('INTEGRATION', error.message);
    throw error;
  }
  const before = current?.config;
  return {
    id: 'fast',
    changes: auditChanges(
      {
        baseUrl: before?.baseUrl ?? null,
        username: before?.username ?? null,
        enabled: before?.enabled ?? null,
        password: before?.password ? 'đã lưu' : null,
      },
      {
        baseUrl: next.baseUrl,
        username: next.username,
        enabled: next.enabled,
        password: input.password ? 'đã đổi' : before?.password ? 'đã lưu' : null,
      },
    ),
  };
}

/** Đăng nhập thử vào FAST bằng cấu hình đang nhập (mật khẩu trống thì dùng mật khẩu đã lưu). */
export async function testFastConnection(input: SaveFastConnectionInput): Promise<string> {
  const current = await loadConfig().catch(() => null);
  const config: FastConfig = {
    baseUrl: input.baseUrl.replace(/\/+$/, ''),
    username: input.username,
    password: input.password || current?.config.password || '',
    enabled: input.enabled,
  };
  if (!config.password) throw new DomainError('VALIDATION', 'Nhập mật khẩu API để kiểm tra');
  try {
    await fastLogin(config);
    return 'Đăng nhập FAST thành công';
  } catch (error) {
    if (error instanceof FastApiError) throw new DomainError('INTEGRATION', error.message);
    throw error;
  }
}
