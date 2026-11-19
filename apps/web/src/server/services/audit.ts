import 'server-only';
import { headers } from 'next/headers';
import type { AuditAction, AuditChanges, AuditEntityType } from '@seedgw/contracts/audit';
import { db } from '@seedgw/db/client';
import type { CurrentUser } from '@/server/auth/current-user';

type AuditEntry = {
  // Bat buoc truyen ca nguoi dung de khong the quen ghi nguoi dang nhap thay.
  actor: Pick<CurrentUser, 'id' | 'impersonator'>;
  action: AuditAction;
  entityType: AuditEntityType;
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

function toRow({ actor, ...entry }: AuditEntry) {
  return { ...entry, actorId: actor.id, impersonatorId: actor.impersonator?.id ?? null };
}

export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    await db.auditLog.create({ data: toRow(entry) });
  } catch (error) {
    console.error('Khong ghi duoc nhat ky thao tac', error);
  }
}

export async function writeAuditMany(entries: readonly AuditEntry[]): Promise<void> {
  try {
    await db.auditLog.createMany({ data: entries.map(toRow) });
  } catch (error) {
    console.error('Khong ghi duoc nhat ky thao tac', error);
  }
}
