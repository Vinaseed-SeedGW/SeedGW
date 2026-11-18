import 'server-only';
import type { AuditAction } from '@dms/contracts/audit';
import type { MobileUser } from '@/server/auth/mobile';
import { writeAudit } from './audit';
import type { SupportMutation } from './support';

/** Nhật ký thao tác Hỗ trợ gửi từ app (T3, T5). Gửi lại cùng clientId không ghi thêm. */
export async function auditMobileSupport(
  user: MobileUser,
  action: AuditAction,
  outcome: SupportMutation,
  ip: string | null,
): Promise<void> {
  if (!outcome.created) return;
  await writeAudit({
    actor: { id: user.id, impersonator: null },
    action,
    entityType: 'SupportRequest',
    entityId: outcome.id,
    entityLabel: outcome.code,
    changes: outcome.changes,
    ip,
  });
}
