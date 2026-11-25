import 'server-only';
import type { Prisma } from '@prisma/client';
import {
  LOCATION_CONSENT_KIND,
  LOCATION_CONSENT_VERSION,
  normalizeConsentCode,
  type ConsentRecordView,
  type ConsentStatus,
  type ConsentStatusInput,
  type ConsentStatusPage,
  type ConsentStatusRow,
  type ConsentVerification,
  type MobileConsentStatus,
} from '@seedgw/contracts/consents';
import { escapeLikePattern, normalizeSearchText } from '@seedgw/contracts/text';
import { db } from '@seedgw/db/client';
import { checkConsentRecord } from '@seedgw/db/consent-ledger';
import { redirect } from 'next/navigation';
import { assertCan, can } from '@/server/auth/can';
import { getCurrentUser, requireUser, type CurrentUser } from '@/server/auth/current-user';
import { getScopedDb } from '@/server/auth/scoped-db';
import {
  CONSENT_RECORD_SELECT,
  listOwnConsentRecords,
  readLocationConsent,
  toConsentRecordView,
} from '@/server/services/consents';

const CURRENT = { kind: LOCATION_CONSENT_KIND, version: LOCATION_CONSENT_VERSION };

/**
 * Trang Đồng ý của tôi mở được cả khi chưa đồng ý hay đã rút lại, nên không dùng requireUser (hàm đó
 * chuyển người chưa đồng ý về trang hỏi đồng ý).
 */
export async function signedInUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/api/session/expired');
  return user;
}

export async function getMyConsents(): Promise<{
  user: CurrentUser;
  status: MobileConsentStatus;
  records: ConsentRecordView[];
}> {
  const user = await signedInUser();
  const [status, records] = await Promise.all([
    readLocationConsent(user.id),
    listOwnConsentRecords(user.id),
  ]);
  return { user, status, records };
}

/** Một dòng sổ: chính chủ, hoặc người quản lý tài khoản trong phạm vi dữ liệu. */
async function findVisibleRecord(
  where: Prisma.ConsentRecordWhereInput,
): Promise<ConsentRecordView | null> {
  const user = await signedInUser();
  // pham-vi-toan-bo: chỉ đọc khi là dòng của chính người đăng nhập, dòng của người khác đọc qua phạm vi.
  const own = await db.consentRecord.findFirst({
    where: { AND: [where, { userId: user.id }] },
    select: CONSENT_RECORD_SELECT,
  });
  if (own) return toConsentRecordView(own);
  if (!can(user, 'admin.user.read')) return null;
  const scoped = await getScopedDb();
  const other = await scoped.consentRecord.findFirst({ where, select: CONSENT_RECORD_SELECT });
  return other ? toConsentRecordView(other) : null;
}

export async function getConsentRecord(id: string): Promise<ConsentRecordView | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return findVisibleRecord({ id });
}

/** Kiểm chứng theo mã in trên giấy (16 ký tự) hoặc mã đầy đủ (64 ký tự). */
export async function verifyConsentCode(raw: string): Promise<ConsentVerification | null> {
  const code = normalizeConsentCode(raw);
  if (code.length !== 16 && code.length !== 64) return null;
  const record = await findVisibleRecord(
    code.length === 64 ? { recordHash: code } : { recordHash: { startsWith: code } },
  );
  if (!record) return null;
  // pham-vi-toan-bo: đã kiểm quyền xem dòng này ở trên; đọc lại bản gốc để tính lại mã.
  const stored = await db.consentRecord.findUniqueOrThrow({ where: { id: record.id } });
  return { record, ...(await checkConsentRecord(stored)) };
}

function statusWhere(status: ConsentStatus | undefined): Prisma.UserWhereInput {
  switch (status) {
    case 'ACCEPTED':
      return { consents: { some: { ...CURRENT, withdrawnAt: null } } };
    case 'WITHDRAWN':
      return { consents: { some: { ...CURRENT, withdrawnAt: { not: null } } } };
    case 'NONE':
      return { consents: { none: CURRENT } };
    default:
      return {};
  }
}

export function consentStatusWhere(input: Pick<ConsentStatusInput, 'q' | 'status'>) {
  const search = input.q ? normalizeSearchText(input.q) : '';
  return {
    isActive: true,
    ...(search ? { searchText: { contains: escapeLikePattern(search) } } : {}),
    ...statusWhere(input.status),
  } satisfies Prisma.UserWhereInput;
}

export const CONSENT_STATUS_SELECT = {
  id: true,
  employeeCode: true,
  fullName: true,
  orgUnit: { select: { name: true } },
  consents: { where: CURRENT, select: { acceptedAt: true, withdrawnAt: true, channel: true } },
  consentRecords: {
    where: { kind: CURRENT.kind },
    orderBy: { seq: 'desc' as const },
    take: 1,
    select: { id: true },
  },
} satisfies Prisma.UserSelect;

export function toConsentStatusRow(
  row: Prisma.UserGetPayload<{ select: typeof CONSENT_STATUS_SELECT }>,
): ConsentStatusRow {
  const consent = row.consents[0];
  const status: ConsentStatus = !consent ? 'NONE' : consent.withdrawnAt ? 'WITHDRAWN' : 'ACCEPTED';
  return {
    userId: row.id,
    employeeCode: row.employeeCode,
    fullName: row.fullName,
    orgUnitName: row.orgUnit?.name ?? null,
    status,
    lastAt: consent ? (consent.withdrawnAt ?? consent.acceptedAt).toISOString() : null,
    lastChannel: consent?.channel ?? null,
    lastRecordId: row.consentRecords[0]?.id ?? null,
  };
}

/** Quản trị › Đồng ý dữ liệu: tình trạng đồng ý của từng tài khoản đang hoạt động trong phạm vi. */
export async function listConsentStatuses(input: ConsentStatusInput): Promise<ConsentStatusPage> {
  const [user, scoped] = await Promise.all([requireUser(), getScopedDb()]);
  assertCan(user, 'admin.user.read');
  const where = consentStatusWhere(input);
  const [rows, total] = await Promise.all([
    scoped.user.findMany({
      where,
      orderBy: [{ employeeCode: 'asc' }, { id: 'asc' }],
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
      select: CONSENT_STATUS_SELECT,
    }),
    scoped.user.count({ where }),
  ]);
  return { items: rows.map(toConsentStatusRow), total, page: input.page, pageSize: input.pageSize };
}

/** Số tài khoản theo từng tình trạng, hiện trên đầu trang quản trị. */
export async function countConsentStatuses(): Promise<Record<ConsentStatus, number>> {
  const [user, scoped] = await Promise.all([requireUser(), getScopedDb()]);
  assertCan(user, 'admin.user.read');
  const [accepted, withdrawn, none] = await Promise.all(
    (['ACCEPTED', 'WITHDRAWN', 'NONE'] as const).map((status) =>
      scoped.user.count({ where: consentStatusWhere({ status }) }),
    ),
  );
  return { ACCEPTED: accepted ?? 0, WITHDRAWN: withdrawn ?? 0, NONE: none ?? 0 };
}
