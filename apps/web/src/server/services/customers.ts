import 'server-only';
import type { Prisma } from '@prisma/client';
import { auditChanges, type AuditChanges } from '@seedgw/contracts/audit';
import {
  CUSTOMER_KIND_LABEL,
  formatAreaHa,
  type CreateCustomerInput,
  type ListCustomersInput,
  type UpdateCustomerInput,
} from '@seedgw/contracts/customers';
import { formatSequenceCode } from '@seedgw/contracts/settings';
import { escapeLikePattern, normalizeSearchText } from '@seedgw/contracts/text';
import { db } from '@seedgw/db/client';
import type { CurrentUser } from '@/server/auth/current-user';
import { getScopedDb } from '@/server/auth/scoped-db';
import { DomainError } from '@/server/services/domain-error';

const CUSTOMER_SEQUENCE_KEY = 'customer';

export function buildCustomerWhere(
  input: Pick<ListCustomersInput, 'q' | 'kind' | 'province' | 'crop' | 'dealerId'>,
): Prisma.CustomerWhereInput {
  const search = input.q ? normalizeSearchText(input.q) : '';
  return {
    ...(search ? { searchText: { contains: escapeLikePattern(search) } } : {}),
    ...(input.kind ? { kind: input.kind } : {}),
    ...(input.province ? { provinceName: input.province } : {}),
    ...(input.crop ? { crops: { has: input.crop } } : {}),
    ...(input.dealerId ? { dealers: { some: { dealerId: input.dealerId } } } : {}),
  };
}

type Tx = Prisma.TransactionClient;

/** Cấp mã KH trong transaction; lỗi giữa chừng thì số không bị dùng mất. */
async function issueCustomerCode(tx: Tx): Promise<string> {
  const rows = await tx.$queryRaw<Array<{ prefix: string; digits: number; value: number }>>`
    UPDATE code_sequences SET next_value = next_value + 1, updated_at = now()
    WHERE key = ${CUSTOMER_SEQUENCE_KEY} AND next_value <= range_end
    RETURNING prefix, digits, next_value - 1 AS value
  `;
  const row = rows[0];
  if (!row) {
    throw new DomainError(
      'CONFLICT',
      'Dải mã khách hàng đã dùng hết, vui lòng liên hệ Quản trị hệ thống',
    );
  }
  return formatSequenceCode(row.prefix, row.digits, Number(row.value));
}

/** Người phụ trách phải đang hoạt động và trong phạm vi của người sửa; đơn vị khách hàng theo người đó. */
async function resolveAssignee(
  actor: CurrentUser,
  assignedUserId: string | null,
): Promise<{ id: string; name: string; orgUnitId: string | null }> {
  if (!assignedUserId || assignedUserId === actor.id) {
    return { id: actor.id, name: actor.fullName, orgUnitId: actor.orgUnitId };
  }
  const scoped = await getScopedDb();
  const user = await scoped.user.findFirst({
    where: { id: assignedUserId, isActive: true },
    select: { id: true, fullName: true, orgUnitId: true },
  });
  if (!user) {
    throw new DomainError('VALIDATION', 'Nhân viên phụ trách không hợp lệ', {
      assignedUserId: 'Chỉ chọn được nhân viên đang hoạt động trong phạm vi của bạn',
    });
  }
  return { id: user.id, name: user.fullName, orgUnitId: user.orgUnitId };
}

/** Đại lý khách hàng hay mua: chỉ nhận đại lý trong phạm vi của người sửa. */
async function resolveDealers(
  dealerIds: readonly string[],
): Promise<{ id: string; name: string }[]> {
  if (dealerIds.length === 0) return [];
  const scoped = await getScopedDb();
  const dealers = await scoped.dealer.findMany({
    where: { id: { in: [...dealerIds] } },
    select: { id: true, name: true },
  });
  if (dealers.length !== new Set(dealerIds).size) {
    throw new DomainError('VALIDATION', 'Có đại lý không hợp lệ', {
      dealerIds: 'Chỉ chọn được đại lý trong phạm vi của bạn',
    });
  }
  return dealers;
}

function auditFields(input: {
  kind: CreateCustomerInput['kind'];
  name: string;
  phone: string | null;
  provinceName: string | null;
  address: string;
  crops: readonly string[];
  areaHa: number | null;
  note: string | null;
  assigneeName: string | null;
  dealerNames: readonly string[];
}) {
  return {
    Loại: CUSTOMER_KIND_LABEL[input.kind],
    Tên: input.name,
    'Số điện thoại': input.phone,
    Tỉnh: input.provinceName,
    'Địa chỉ': input.address || null,
    'Cây trồng': input.crops.join(', ') || null,
    'Diện tích': input.areaHa === null ? null : formatAreaHa(input.areaHa),
    'Ghi chú': input.note,
    'Người phụ trách': input.assigneeName,
    'Đại lý hay mua': [...input.dealerNames].sort().join(', ') || null,
  };
}

export type CustomerOutcome = { id: string; label: string; changes: AuditChanges };

export async function createCustomer(
  actor: CurrentUser,
  input: CreateCustomerInput,
): Promise<CustomerOutcome> {
  const [assignee, dealers] = await Promise.all([
    resolveAssignee(actor, input.assignedUserId),
    resolveDealers(input.dealerIds),
  ]);
  const created = await db.$transaction(async (tx) => {
    const code = await issueCustomerCode(tx);
    return tx.customer.create({
      data: {
        code,
        kind: input.kind,
        name: input.name,
        phone: input.phone,
        provinceName: input.provinceName,
        address: input.address,
        crops: input.crops,
        areaHa: input.areaHa,
        note: input.note,
        assignedUserId: assignee.id,
        orgUnitId: assignee.orgUnitId,
        createdById: actor.id,
        dealers: { create: dealers.map((dealer) => ({ dealerId: dealer.id })) },
      },
      select: { id: true, code: true, name: true },
    });
  });
  return {
    id: created.id,
    label: `${created.code} ${created.name}`,
    changes: auditChanges(
      {},
      auditFields({
        ...input,
        assigneeName: assignee.name,
        dealerNames: dealers.map((d) => d.name),
      }),
    ),
  };
}

export async function updateCustomer(
  actor: CurrentUser,
  input: UpdateCustomerInput,
): Promise<CustomerOutcome> {
  const scoped = await getScopedDb();
  const current = await scoped.customer.findUnique({
    where: { id: input.id },
    select: {
      code: true,
      kind: true,
      name: true,
      phone: true,
      provinceName: true,
      address: true,
      crops: true,
      areaHa: true,
      note: true,
      assignedUserId: true,
      assignedUser: { select: { fullName: true } },
      dealers: { select: { dealer: { select: { id: true, name: true } } } },
    },
  });
  if (!current) {
    throw new DomainError('NOT_FOUND', 'Không tìm thấy khách hàng hoặc bạn không có quyền xem');
  }
  const keepAssignee = input.assignedUserId === current.assignedUserId;
  const [assignee, dealers] = await Promise.all([
    keepAssignee ? Promise.resolve(null) : resolveAssignee(actor, input.assignedUserId),
    resolveDealers(input.dealerIds),
  ]);

  await db.$transaction([
    db.customer.update({
      where: { id: input.id },
      data: {
        kind: input.kind,
        name: input.name,
        phone: input.phone,
        provinceName: input.provinceName,
        address: input.address,
        crops: input.crops,
        areaHa: input.areaHa,
        note: input.note,
        ...(assignee ? { assignedUserId: assignee.id, orgUnitId: assignee.orgUnitId } : {}),
      },
    }),
    db.customerDealer.deleteMany({ where: { customerId: input.id } }),
    db.customerDealer.createMany({
      data: dealers.map((dealer) => ({ customerId: input.id, dealerId: dealer.id })),
    }),
  ]);

  const before = auditFields({
    kind: current.kind,
    name: current.name,
    phone: current.phone,
    provinceName: current.provinceName,
    address: current.address,
    crops: current.crops,
    areaHa: current.areaHa,
    note: current.note,
    assigneeName: current.assignedUser?.fullName ?? null,
    dealerNames: current.dealers.map((row) => row.dealer.name),
  });
  const after = auditFields({
    ...input,
    assigneeName: assignee ? assignee.name : (current.assignedUser?.fullName ?? null),
    dealerNames: dealers.map((dealer) => dealer.name),
  });
  return {
    id: input.id,
    label: `${current.code} ${input.name}`,
    changes: auditChanges(before, after),
  };
}
