import 'server-only';
import type { AuditAction } from '@dms/contracts/audit';
import { mobileScopedDb, type MobileUser } from '@/server/auth/mobile';
import type { ApprovalOutcome, ApprovalViewer } from './approvals';
import { writeAuditMany } from './audit';

export async function mobileApprovalViewer(user: MobileUser): Promise<ApprovalViewer> {
  return {
    id: user.id,
    canRead: user.permissions.has('sales.approval.read'),
    canReview: user.permissions.has('sales.approval.review'),
    scoped: await mobileScopedDb(user),
  };
}

export function auditMobileApproval(
  user: MobileUser,
  action: AuditAction,
  outcomes: readonly ApprovalOutcome[],
  ip: string | null,
): Promise<void> {
  return writeAuditMany(
    outcomes.map((outcome) => ({
      actor: { id: user.id, impersonator: null },
      action,
      entityType: 'ApprovalRequest' as const,
      entityId: outcome.requestId,
      entityLabel: outcome.code,
      changes: outcome.changes,
      ip,
    })),
  );
}
