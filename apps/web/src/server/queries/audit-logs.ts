import 'server-only';
import {
  AUDIT_ACTION_LABEL,
  AUDIT_FIELD_LABEL,
  formatAuditValue,
  type AuditAction,
  type AuditChanges,
  type ListAuditLogsInput,
  type ListAuditLogsResult,
} from '@dms/contracts/audit';
import { db } from '@dms/db/client';
import { assertCan } from '@/server/auth/can';
import { requireUser } from '@/server/auth/current-user';

export async function listAuditLogs(input: ListAuditLogsInput): Promise<ListAuditLogsResult> {
  const user = await requireUser();
  assertCan(user, 'admin.audit-log.read');

  const [rows, total] = await Promise.all([
    db.auditLog.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
      select: {
        id: true,
        createdAt: true,
        action: true,
        entityLabel: true,
        changes: true,
        ip: true,
        actor: { select: { fullName: true } },
      },
    }),
    db.auditLog.count(),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      actorName: row.actor?.fullName ?? null,
      actionLabel: AUDIT_ACTION_LABEL[row.action as AuditAction] ?? row.action,
      entityLabel: row.entityLabel,
      changes: Object.entries(row.changes as AuditChanges).map(([field, change]) => ({
        label: AUDIT_FIELD_LABEL[field] ?? field,
        before: formatAuditValue(change.before),
        after: formatAuditValue(change.after),
      })),
      ip: row.ip,
    })),
    total,
    page: input.page,
    pageSize: input.pageSize,
  };
}
