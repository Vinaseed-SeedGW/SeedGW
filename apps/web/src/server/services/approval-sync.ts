import 'server-only';
import type { CurrentUser } from '@/server/auth/current-user';
import { refreshPendingApprovers } from './approvals';
import { writeAuditMany } from './audit';
import { refreshProposalApprovers } from './dealer-proposals';

/**
 * Gọi sau khi đổi cơ cấu (Trưởng đơn vị, Quản lý trực tiếp, Có cấp Quản lý, chuyển đơn vị, khoá tài khoản)
 * để phiếu đang chờ chuyển sang người duyệt mới. Thay đổi cơ cấu đã lưu xong nên lỗi ở đây chỉ ghi log.
 */
export async function syncPendingApprovers(
  actor: Pick<CurrentUser, 'id' | 'impersonator'>,
  ip: string | null,
): Promise<number> {
  try {
    const [outcomes] = await Promise.all([refreshPendingApprovers(), refreshProposalApprovers()]);
    if (outcomes.length > 0) {
      await writeAuditMany(
        outcomes.map((outcome) => ({
          actor,
          action: 'approval.reassign' as const,
          entityType: 'ApprovalRequest' as const,
          entityId: outcome.requestId,
          entityLabel: outcome.code,
          changes: outcome.changes,
          ip,
        })),
      );
    }
    return outcomes.length;
  } catch (error) {
    console.error('Khong doi duoc nguoi duyet phieu dang cho', error);
    return 0;
  }
}
