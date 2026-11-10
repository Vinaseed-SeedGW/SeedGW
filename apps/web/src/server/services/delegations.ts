import 'server-only';
import { auditChanges, type AuditChanges } from '@dms/contracts/audit';
import { vietnamToday } from '@dms/contracts/format';
import {
  DELEGATION_STATUS_LABEL,
  delegationAuditLabel,
  delegationPeriodText,
  resolveDelegationStatus,
  type CreateDelegationInput,
} from '@dms/contracts/workflows';
import { db } from '@dms/db/client';
import type { CurrentUser } from '@/server/auth/current-user';
import { getScopedDb } from '@/server/auth/scoped-db';
import { DomainError } from '@/server/services/domain-error';
import { dateFromInput, dateToInput } from '@/server/services/users';

export type DelegationOutcome = { id: string; label: string; changes: AuditChanges };

const DELEGATION_LOCK_KEY = 72026002;

export async function createDelegation(
  actor: CurrentUser,
  input: CreateDelegationInput,
): Promise<DelegationOutcome> {
  if (input.endDate < vietnamToday()) {
    const message = 'Đến ngày không được ở trong quá khứ';
    throw new DomainError('VALIDATION', message, { endDate: message });
  }

  const scoped = await getScopedDb();
  const select = { id: true, fullName: true } as const;
  const [delegator, delegate] = await Promise.all([
    scoped.user.findFirst({ where: { id: input.delegatorId, isActive: true }, select }),
    scoped.user.findFirst({ where: { id: input.delegateId, isActive: true }, select }),
  ]);
  const notFoundMessage = 'Người này không tồn tại, đã bị khoá hoặc ngoài phạm vi của bạn';
  if (!delegator) {
    throw new DomainError('VALIDATION', notFoundMessage, { delegatorId: notFoundMessage });
  }
  if (!delegate) {
    throw new DomainError('VALIDATION', notFoundMessage, { delegateId: notFoundMessage });
  }

  const startDate = dateFromInput(input.startDate) as Date;
  const endDate = dateFromInput(input.endDate) as Date;

  const created = await db.$transaction(async (tx) => {
    // Khoa de hai nguoi cung tao khong sinh ra hai uy quyen chong thoi gian.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${DELEGATION_LOCK_KEY})`;
    const overlapping = await tx.delegation.findFirst({
      where: {
        delegatorId: input.delegatorId,
        revokedAt: null,
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      select: { id: true },
    });
    if (overlapping) {
      throw new DomainError(
        'CONFLICT',
        'Người này đã có uỷ quyền trùng khoảng thời gian, cần thu hồi uỷ quyền cũ trước',
      );
    }
    return tx.delegation.create({
      data: {
        delegatorId: input.delegatorId,
        delegateId: input.delegateId,
        startDate,
        endDate,
        reason: input.reason,
        createdById: actor.id,
      },
      select: { id: true },
    });
  });

  return {
    id: created.id,
    label: delegationAuditLabel(delegator.fullName, delegate.fullName),
    changes: auditChanges(
      {},
      {
        delegator: delegator.fullName,
        delegate: delegate.fullName,
        period: delegationPeriodText(input.startDate, input.endDate),
        reason: input.reason,
      },
    ),
  };
}

export async function revokeDelegation(id: string): Promise<DelegationOutcome> {
  const scoped = await getScopedDb();
  const delegation = await scoped.delegation.findFirst({
    where: { id },
    select: {
      revokedAt: true,
      startDate: true,
      endDate: true,
      delegator: { select: { fullName: true } },
      delegate: { select: { fullName: true } },
    },
  });
  if (!delegation) throw new DomainError('NOT_FOUND', 'Không tìm thấy uỷ quyền này');

  const status = resolveDelegationStatus(
    {
      startDate: dateToInput(delegation.startDate),
      endDate: dateToInput(delegation.endDate),
      isRevoked: delegation.revokedAt !== null,
    },
    vietnamToday(),
  );
  if (status === 'REVOKED' || status === 'EXPIRED') {
    throw new DomainError('CONFLICT', 'Uỷ quyền này đã kết thúc, không cần thu hồi');
  }

  const { count } = await db.delegation.updateMany({
    where: { id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (count === 0) throw new DomainError('CONFLICT', 'Uỷ quyền này đã được thu hồi');

  return {
    id,
    label: delegationAuditLabel(delegation.delegator.fullName, delegation.delegate.fullName),
    changes: auditChanges(
      { status: DELEGATION_STATUS_LABEL[status] },
      { status: DELEGATION_STATUS_LABEL.REVOKED },
    ),
  };
}
