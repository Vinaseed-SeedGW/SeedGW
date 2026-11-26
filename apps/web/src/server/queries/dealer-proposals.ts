import 'server-only';
import type {
  DealerCreateMode,
  DealerProposalOptions,
  ListDealerProposalsInput,
  ListDealerProposalsResult,
  ScopedProposalsInput,
} from '@seedgw/contracts/dealer-proposals';
import type { DealerFormOptions } from '@seedgw/contracts/dealers';
import { db } from '@seedgw/db/client';
import { mapTileConfig } from '@/server/integrations/map-tiles';
import { assertCan, can } from '@/server/auth/can';
import { requireUser } from '@/server/auth/current-user';
import { getAssignableOrgUnitIds, getScopedDb } from '@/server/auth/scoped-db';
import { buildOrgUnitLabels, unitPathOf } from '@/server/queries/users';
import { readProvinceUnits } from '@/server/services/regions';
import {
  countPendingProposals,
  listProposals,
  countProposalsForApprover,
  listProposalsForApprover,
  listScopedProposals,
  resolveDealerCreateMode,
} from '@/server/services/dealer-proposals';

// Đại lý mới (M10). 25/11/2026: Quản lý, Lãnh đạo đơn vị duyệt ở Cần duyệt; Quản trị đơn vị xem ở Quản trị
// › Đại lý mới, Quản trị hệ thống duyệt thay ở đó.

export async function listDealerProposals(
  input: ListDealerProposalsInput,
): Promise<ListDealerProposalsResult> {
  const user = await requireUser();
  assertCan(user, 'admin.dealer-proposal.approve');
  return listProposals(input);
}

/** Số đề xuất chờ duyệt cạnh mục Đại lý mới trên menu, chỉ cho người duyệt thay được. */
export async function getDealerProposalPendingCount(): Promise<number> {
  const user = await requireUser();
  if (!can(user, 'admin.dealer-proposal.approve') || !can(user, 'sales.approval.override')) {
    return 0;
  }
  return countPendingProposals();
}

/** Đơn vị và nhân viên phụ trách người duyệt được chọn khi tạo đại lý từ đề xuất. */
export async function getDealerProposalOptions(): Promise<DealerProposalOptions> {
  const user = await requireUser();
  const isApprover = can(user, 'sales.approval.review');
  if (!isApprover) assertCan(user, 'sales.approval.override');
  const [scoped, assignable] = await Promise.all([getScopedDb(), getAssignableOrgUnitIds()]);
  const [units, users, provinceUnits] = await Promise.all([
    db.orgUnit.findMany({ select: { id: true, name: true, parentId: true } }),
    scoped.user.findMany({
      where: { isActive: true },
      orderBy: { employeeCode: 'asc' },
      select: { id: true, employeeCode: true, fullName: true, orgUnitId: true },
    }),
    readProvinceUnits(),
  ]);
  const labels = buildOrgUnitLabels(units);
  return {
    // Người duyệt chỉ giao đại lý cho đơn vị của người đề xuất, bảng duyệt tự lọc theo từng dòng.
    orgUnits:
      assignable && !isApprover ? labels.filter((unit) => assignable.has(unit.value)) : labels,
    users: users.map((row) => ({
      value: row.id,
      label: `${row.employeeCode} - ${row.fullName}`,
      unitPath: unitPathOf(units, row.orgUnitId),
    })),
    provinceUnits,
  };
}

export type DealerCreateFormData = {
  mode: DealerCreateMode;
  /** Người sẽ duyệt khi nhân viên thêm, để form báo trước. */
  approverName: string | null;
  orgUnits: { value: string; label: string }[];
  users: DealerProposalOptions['users'];
  provinceUnits: DealerProposalOptions['provinceUnits'];
  mapTiles: DealerFormOptions['mapTiles'];
};

/** Form Thêm đại lý trên web (26/11/2026): cách xử lý khi lưu, và đơn vị, nhân viên cho Quản trị chọn. */
export async function getDealerCreateFormData(): Promise<DealerCreateFormData> {
  const user = await requireUser();
  if (!can(user, 'admin.dealer-proposal.approve')) assertCan(user, 'sales.dealer.propose');
  const { mode, approverId } = await resolveDealerCreateMode(user);
  const approver =
    mode === 'APPROVAL' && approverId
      ? // pham-vi-toan-bo: chỉ đọc tên người duyệt trong chuỗi, người duyệt có thể ở ngoài phạm vi nhân viên.
        await db.user.findUnique({ where: { id: approverId }, select: { fullName: true } })
      : null;
  if (mode !== 'ASSIGN') {
    return {
      mode,
      approverName: approver?.fullName ?? null,
      orgUnits: [],
      users: [],
      provinceUnits: {},
      mapTiles: mapTileConfig(),
    };
  }
  const [scoped, assignable] = await Promise.all([getScopedDb(), getAssignableOrgUnitIds()]);
  const [units, users, provinceUnits] = await Promise.all([
    db.orgUnit.findMany({ select: { id: true, name: true, parentId: true } }),
    scoped.user.findMany({
      where: { isActive: true },
      orderBy: { employeeCode: 'asc' },
      select: { id: true, employeeCode: true, fullName: true, orgUnitId: true },
    }),
    readProvinceUnits(),
  ]);
  const labels = buildOrgUnitLabels(units);
  return {
    mode,
    approverName: null,
    orgUnits: assignable ? labels.filter((unit) => assignable.has(unit.value)) : labels,
    users: users.map((row) => ({
      value: row.id,
      label: `${row.employeeCode} - ${row.fullName}`,
      unitPath: unitPathOf(units, row.orgUnitId),
    })),
    provinceUnits,
    mapTiles: mapTileConfig(),
  };
}

/** Tab Đại lý mới ở Cần duyệt: đề xuất đang chờ chính người đăng nhập duyệt. */
export async function listProposalsWaitingForMe(
  page: number,
  pageSize: number,
): Promise<ListDealerProposalsResult> {
  const user = await requireUser();
  assertCan(user, 'sales.approval.review');
  return listProposalsForApprover(user.id, page, pageSize);
}

/** Trang Đại lý đề xuất: theo phạm vi dữ liệu, nhân viên chỉ thấy đề xuất của mình. */
export async function listProposalsInScope(
  input: ScopedProposalsInput,
): Promise<ListDealerProposalsResult> {
  const user = await requireUser();
  assertCan(user, 'sales.dealer.read');
  return listScopedProposals(input);
}

/** Số đề xuất chờ người đăng nhập duyệt, hiện trên tab Đại lý mới ở Cần duyệt. */
export async function countProposalsWaitingForMe(): Promise<number> {
  const user = await requireUser();
  if (!can(user, 'sales.approval.review')) return 0;
  return countProposalsForApprover(user.id);
}
