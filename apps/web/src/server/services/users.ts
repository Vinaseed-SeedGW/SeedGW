import 'server-only';
import { auditChanges, type AuditChanges } from '@dms/contracts/audit';
import type { UpdateUserInput } from '@dms/contracts/users';
import { getScopedDb } from '@/server/auth/scoped-db';

type UpdateUserOutcome = { employeeCode: string; changes: AuditChanges };

export async function updateUser(input: UpdateUserInput): Promise<UpdateUserOutcome | null> {
  const scoped = await getScopedDb();
  const current = await scoped.user.findUnique({
    where: { id: input.id },
    select: { employeeCode: true, fullName: true, isActive: true },
  });
  if (!current) return null;

  const next = { fullName: input.fullName, isActive: input.isActive };
  const changes = auditChanges({ fullName: current.fullName, isActive: current.isActive }, next);

  if (Object.keys(changes).length > 0) {
    await scoped.user.update({ where: { id: input.id }, data: next });
  }
  return { employeeCode: current.employeeCode, changes };
}
