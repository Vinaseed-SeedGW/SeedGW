import 'server-only';
import type {
  DealerProposalOptions,
  ListDealerProposalsInput,
  ListDealerProposalsResult,
} from '@seedgw/contracts/dealer-proposals';
import { db } from '@seedgw/db/client';
import { assertCan, can } from '@/server/auth/can';
import { requireUser } from '@/server/auth/current-user';
import { getAssignableOrgUnitIds, getScopedDb } from '@/server/auth/scoped-db';
import { buildOrgUnitLabels } from '@/server/queries/users';
import { countPendingProposals, listProposals } from '@/server/services/dealer-proposals';

// Đại lý mới (M10): Quản trị đơn vị duyệt đề xuất của nhân viên trong đơn vị và đơn vị con.

export async function listDealerProposals(
  input: ListDealerProposalsInput,
): Promise<ListDealerProposalsResult> {
  const user = await requireUser();
  assertCan(user, 'admin.dealer-proposal.approve');
  return listProposals(input);
}

/** Số đề xuất chờ duyệt cạnh mục Đại lý mới trên menu. */
export async function getDealerProposalPendingCount(): Promise<number> {
  const user = await requireUser();
  if (!can(user, 'admin.dealer-proposal.approve')) return 0;
  return countPendingProposals();
}

/** Đơn vị và nhân viên phụ trách người duyệt được chọn khi tạo đại lý từ đề xuất. */
export async function getDealerProposalOptions(): Promise<DealerProposalOptions> {
  const user = await requireUser();
  assertCan(user, 'admin.dealer-proposal.approve');
  const [scoped, assignable] = await Promise.all([getScopedDb(), getAssignableOrgUnitIds()]);
  const [units, users] = await Promise.all([
    db.orgUnit.findMany({ select: { id: true, name: true, parentId: true } }),
    scoped.user.findMany({
      where: { isActive: true },
      orderBy: { employeeCode: 'asc' },
      select: { id: true, employeeCode: true, fullName: true },
    }),
  ]);
  const labels = buildOrgUnitLabels(units);
  return {
    orgUnits: assignable ? labels.filter((unit) => assignable.has(unit.value)) : labels,
    users: users.map((row) => ({ value: row.id, label: `${row.employeeCode} - ${row.fullName}` })),
  };
}
