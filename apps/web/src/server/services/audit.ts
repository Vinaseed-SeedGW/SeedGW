import 'server-only';
import { headers } from 'next/headers';
import type { AuditAction, AuditChanges } from '@dms/contracts/audit';
import { db } from '@dms/db/client';

type AuditEntry = {
  actorId: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  entityLabel: string;
  changes: AuditChanges;
  ip: string | null;
};

// Doc truoc khi vao after() vi luc do phan hoi da gui xong.
export async function getClientIp(): Promise<string | null> {
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || requestHeaders.get('x-real-ip');
}

export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    await db.auditLog.create({ data: entry });
  } catch (error) {
    console.error('Khong ghi duoc nhat ky thao tac', error);
  }
}
