import 'server-only';
import type { PermissionCode } from '@dms/contracts/access';
import { db } from '@dms/db/client';
import { DomainError } from '@/server/services/domain-error';
import { assertCan } from './can';
import type { CurrentUser } from './current-user';

/**
 * Người đứng tên phiếu: chính mình (cần quyền đăng ký), hoặc nhân viên khác khi Quản trị hệ thống gửi thay
 * (cần quyền sales.approval.override). Nhân viên phải còn hoạt động.
 */
export async function resolveSubmitter(
  user: CurrentUser,
  forUserId: string | null,
  registerPermission: PermissionCode,
): Promise<{ id: string; employeeCode: string }> {
  if (!forUserId || forUserId === user.id) {
    assertCan(user, registerPermission);
    return { id: user.id, employeeCode: user.employeeCode };
  }
  assertCan(user, 'sales.approval.override');
  const target = await db.user.findFirst({
    where: { id: forUserId, isActive: true },
    select: { id: true, employeeCode: true },
  });
  if (!target)
    throw new DomainError('NOT_FOUND', 'Không tìm thấy nhân viên hoặc tài khoản đã khoá');
  return target;
}
