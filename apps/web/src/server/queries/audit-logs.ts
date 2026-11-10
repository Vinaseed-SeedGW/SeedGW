import 'server-only';
import type { Prisma } from '@prisma/client';
import {
  AUDIT_ACTION_LABEL,
  AUDIT_ENTITY_LABEL,
  AUDIT_FIELD_LABEL,
  formatAuditValue,
  type AuditAction,
  type AuditChanges,
  type AuditEntityType,
  type ListAuditLogsInput,
  type ListAuditLogsResult,
} from '@dms/contracts/audit';
import { vietnamDayStart, vietnamNextDayStart } from '@dms/contracts/format';
import { escapeLikePattern, normalizeSearchText } from '@dms/contracts/text';
import { assertCan } from '@/server/auth/can';
import { requireUser } from '@/server/auth/current-user';
import { getScopedDb } from '@/server/auth/scoped-db';

function auditWhere({ q, entityType, from, to }: ListAuditLogsInput) {
  const search = q ? normalizeSearchText(q) : '';
  return {
    ...(search ? { actor: { searchText: { contains: escapeLikePattern(search) } } } : {}),
    ...(entityType ? { entityType } : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: vietnamDayStart(from) } : {}),
            ...(to ? { lt: vietnamNextDayStart(to) } : {}),
          },
        }
      : {}),
  } satisfies Prisma.AuditLogWhereInput;
}

export async function listAuditLogs(input: ListAuditLogsInput): Promise<ListAuditLogsResult> {
  const [user, scoped] = await Promise.all([requireUser(), getScopedDb()]);
  assertCan(user, 'admin.audit-log.read');

  const where = auditWhere(input);
  const [rows, total] = await Promise.all([
    scoped.auditLog.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
      select: {
        id: true,
        createdAt: true,
        action: true,
        entityType: true,
        entityLabel: true,
        changes: true,
        ip: true,
        actor: { select: { fullName: true } },
        impersonator: { select: { fullName: true } },
      },
    }),
    scoped.auditLog.count({ where }),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      actorName: row.actor?.fullName ?? null,
      impersonatorName: row.impersonator?.fullName ?? null,
      actionLabel: AUDIT_ACTION_LABEL[row.action as AuditAction] ?? row.action,
      entityTypeLabel: AUDIT_ENTITY_LABEL[row.entityType as AuditEntityType] ?? row.entityType,
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
