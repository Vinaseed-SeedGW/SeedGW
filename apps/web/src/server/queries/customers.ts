import 'server-only';
import type { Prisma } from '@prisma/client';
import type {
  CustomerDetail,
  CustomerOption,
  CustomerSummary,
  CustomerVisit,
  ListCustomersInput,
  ListCustomersResult,
} from '@seedgw/contracts/customers';
import { assertCan, can } from '@/server/auth/can';
import { requireUser } from '@/server/auth/current-user';
import { getScopedDb } from '@/server/auth/scoped-db';
import { buildCustomerWhere } from '@/server/services/customers';

const SUMMARY_SELECT = {
  id: true,
  code: true,
  kind: true,
  name: true,
  phone: true,
  provinceName: true,
  crops: true,
  areaHa: true,
  lastVisitedAt: true,
  assignedUser: { select: { fullName: true } },
  dealers: { select: { dealer: { select: { name: true } } }, take: 3 },
} satisfies Prisma.CustomerSelect;

type SummaryRecord = Prisma.CustomerGetPayload<{ select: typeof SUMMARY_SELECT }>;

function toSummary(row: SummaryRecord): CustomerSummary {
  return {
    id: row.id,
    code: row.code,
    kind: row.kind,
    name: row.name,
    phone: row.phone,
    provinceName: row.provinceName,
    crops: row.crops,
    areaHa: row.areaHa,
    assignedUserName: row.assignedUser?.fullName ?? null,
    dealerNames: row.dealers.map((item) => item.dealer.name),
    lastVisitedAt: row.lastVisitedAt?.toISOString() ?? null,
  };
}

const ORDER_BY: Record<ListCustomersInput['sort'], Prisma.CustomerOrderByWithRelationInput[]> = {
  name: [{ name: 'asc' }, { id: 'asc' }],
  '-name': [{ name: 'desc' }, { id: 'asc' }],
  code: [{ code: 'asc' }],
  '-code': [{ code: 'desc' }],
  '-lastVisitedAt': [{ lastVisitedAt: { sort: 'desc', nulls: 'last' } }, { id: 'asc' }],
};

/** Nhân viên thấy khách hàng mình phụ trách, quản lý thấy theo đơn vị (phạm vi dữ liệu của vai trò). */
export async function listCustomers(input: ListCustomersInput): Promise<ListCustomersResult> {
  const [user, scoped] = await Promise.all([requireUser(), getScopedDb()]);
  assertCan(user, 'sales.customer.read');
  const where = buildCustomerWhere(input);
  const [rows, total] = await Promise.all([
    scoped.customer.findMany({
      where,
      orderBy: ORDER_BY[input.sort],
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
      select: SUMMARY_SELECT,
    }),
    scoped.customer.count({ where }),
  ]);
  return { items: rows.map(toSummary), total, page: input.page, pageSize: input.pageSize };
}

export async function getCustomer(id: string): Promise<CustomerDetail | null> {
  const [user, scoped] = await Promise.all([requireUser(), getScopedDb()]);
  assertCan(user, 'sales.customer.read');
  const row = await scoped.customer.findUnique({
    where: { id },
    select: {
      ...SUMMARY_SELECT,
      dealers: { select: { dealer: { select: { id: true, name: true, code: true } } } },
      address: true,
      note: true,
      lat: true,
      lng: true,
      assignedUserId: true,
      orgUnit: { select: { name: true } },
      createdBy: { select: { fullName: true } },
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!row) return null;
  const dealers = row.dealers.map((item) => item.dealer);
  return {
    id: row.id,
    code: row.code,
    kind: row.kind,
    name: row.name,
    phone: row.phone,
    provinceName: row.provinceName,
    crops: row.crops,
    areaHa: row.areaHa,
    assignedUserName: row.assignedUser?.fullName ?? null,
    dealerNames: dealers.map((dealer) => dealer.name),
    lastVisitedAt: row.lastVisitedAt?.toISOString() ?? null,
    address: row.address,
    note: row.note,
    dealers,
    orgUnitName: row.orgUnit?.name ?? null,
    assignedUserId: row.assignedUserId,
    createdByName: row.createdBy?.fullName ?? null,
    lat: row.lat,
    lng: row.lng,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const VISIT_LIMIT = 50;

/** Lượt check-in tại khách hàng, trong phạm vi check-in của người xem. */
export async function listCustomerVisits(customerId: string): Promise<CustomerVisit[]> {
  const [user, scoped] = await Promise.all([requireUser(), getScopedDb()]);
  assertCan(user, 'sales.customer.read');
  if (!can(user, 'sales.check-in.read')) return [];
  const rows = await scoped.checkIn.findMany({
    where: { customerId },
    orderBy: { capturedAt: 'desc' },
    take: VISIT_LIMIT,
    select: {
      id: true,
      capturedAt: true,
      note: true,
      address: true,
      flags: true,
      user: { select: { fullName: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    capturedAt: row.capturedAt.toISOString(),
    userName: row.user.fullName,
    note: row.note,
    address: row.address,
    flagged: row.flags.length > 0,
  }));
}

export type CustomerFormOptions = {
  users: CustomerOption[];
  canCreate: boolean;
  canUpdate: boolean;
};

/** Người phụ trách chọn trong phạm vi của người sửa. */
export async function getCustomerFormOptions(): Promise<CustomerFormOptions> {
  const [user, scoped] = await Promise.all([requireUser(), getScopedDb()]);
  const canCreate = can(user, 'sales.customer.create');
  const canUpdate = can(user, 'sales.customer.update');
  if (!canCreate && !canUpdate) return { users: [], canCreate, canUpdate };
  const users = await scoped.user.findMany({
    where: { isActive: true },
    orderBy: { employeeCode: 'asc' },
    select: { id: true, employeeCode: true, fullName: true },
    take: 2000,
  });
  return {
    users: users.map((row) => ({ value: row.id, label: `${row.employeeCode} - ${row.fullName}` })),
    canCreate,
    canUpdate,
  };
}

/** Cây trồng đang có trong phạm vi, cho bộ lọc Cây trồng. */
export async function listCustomerCropFilter(): Promise<string[]> {
  const scoped = await getScopedDb();
  const rows = await scoped.customer.findMany({ select: { crops: true }, take: 5000 });
  return [...new Set(rows.flatMap((row) => row.crops))].sort((a, b) => a.localeCompare(b, 'vi'));
}
