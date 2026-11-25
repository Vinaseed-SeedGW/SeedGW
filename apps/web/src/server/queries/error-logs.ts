import 'server-only';
import type { ListErrorLogsInput, ListErrorLogsResult } from '@seedgw/contracts/error-logs';
import { db } from '@seedgw/db/client';
import { assertCan } from '@/server/auth/can';
import { requireUser } from '@/server/auth/current-user';

/** F9: chỉ Quản trị hệ thống xem; lỗi không thuộc đơn vị nào nên không áp phạm vi. */
export async function listErrorLogs(input: ListErrorLogsInput): Promise<ListErrorLogsResult> {
  const user = await requireUser();
  assertCan(user, 'admin.error-log.read');
  const where = {
    ...(input.source ? { source: input.source } : {}),
    resolvedAt: input.resolved ? { not: null } : null,
  };
  const [rows, total] = await Promise.all([
    db.errorLog.findMany({
      where,
      orderBy: { lastSeenAt: 'desc' },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    }),
    db.errorLog.count({ where }),
  ]);
  const userIds = [...new Set(rows.map((row) => row.userId).filter((id) => id !== null))];
  // pham-vi-toan-bo: chỉ Quản trị hệ thống (admin.error-log.read) xem tên người gặp lỗi.
  const users = userIds.length
    ? await db.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, employeeCode: true, fullName: true },
      })
    : [];
  const nameOf = new Map(users.map((row) => [row.id, `${row.employeeCode} ${row.fullName}`]));
  return {
    items: rows.map((row) => ({
      id: row.id,
      source: row.source,
      message: row.message,
      stack: row.stack,
      path: row.path,
      appVersion: row.appVersion,
      userName: row.userId ? (nameOf.get(row.userId) ?? null) : null,
      count: row.count,
      firstSeenAt: row.firstSeenAt.toISOString(),
      lastSeenAt: row.lastSeenAt.toISOString(),
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
    })),
    total,
    page: input.page,
    pageSize: input.pageSize,
  };
}
