import 'server-only';
import { randomUUID } from 'node:crypto';
import type { DataScope } from '@dms/contracts/access';
import { auditChanges, type AuditChanges } from '@dms/contracts/audit';
import { resolveSystemSettings } from '@dms/contracts/settings';
import {
  canReopenSupport,
  formatSupportCode,
  OPEN_SUPPORT_STATUSES,
  SUPPORT_LEVEL_LABEL,
  SUPPORT_SEVERITY_LABEL,
  SUPPORT_STATS_PERIOD_DAYS,
  SUPPORT_STATUS_LABEL,
  SUPPORT_TYPE_LABEL,
  supportContext,
  supportSequenceKey,
  type ChangeSupportStatusInput,
  type SupportChangeEvent,
  type CreateSupportRequestInput,
  type EscalateSupportInput,
  type ListMySupportInput,
  type ListSupportInboxInput,
  type ReplySupportInput,
  type SupportDetail,
  type SupportEventKind,
  type SupportListResult,
  type SupportSeverity,
  type SupportStats,
  type SupportStatsGroup,
  type SupportStatsPeriod,
  type SupportStatus,
  type SupportSummary,
  type SupportType,
} from '@dms/contracts/support';
import {
  cleanFileName,
  detectSupportFile,
  SUPPORT_MAX_FILE_BYTES,
  SUPPORT_MAX_FILES_PER_MESSAGE,
  type SupportFileKind,
} from '@dms/contracts/support-files';
import { supportDueDates, supportDueOf } from '@dms/contracts/support-sla';
import type { Prisma } from '@prisma/client';
import { db } from '@dms/db/client';
import { getOrgUnitAncestorIds, getOrgUnitTreeIds } from '@dms/db/org-units';
import type { ScopedDb } from '@dms/db/scoped-client';
import { publishSupportChange } from '@/server/integrations/support-events';
import {
  getObject,
  presignGetUrl,
  putObject,
  SUPPORT_FILE_PREFIX,
} from '@/server/integrations/object-storage';
import { DomainError } from './domain-error';

// Hỗ trợ (T1, T2, T5): yêu cầu CBNV gửi quản trị. Dùng chung cho web (Server Action) và app (API).

type Tx = Prisma.TransactionClient;

/** Người đang thao tác, lấy được từ phiên web hoặc phiên app. */
export type SupportActor = {
  id: string;
  orgUnitId: string | null;
  dataScope: DataScope;
  permissions: ReadonlySet<string>;
};

export type SupportUpload = { name: string; bytes: Uint8Array };

const MANAGE = 'support.request.manage';
const CREATE = 'support.request.create';

export function canManageSupport(actor: SupportActor): boolean {
  return actor.permissions.has(MANAGE);
}

/** Quản trị hệ thống: quyền xử lý và phạm vi toàn công ty. */
export function isSystemHandler(actor: SupportActor): boolean {
  return canManageSupport(actor) && actor.dataScope === 'ALL';
}

function assertCreate(actor: SupportActor): void {
  if (!actor.permissions.has(CREATE)) {
    throw new DomainError('FORBIDDEN', 'Tài khoản chưa được cấp quyền gửi yêu cầu hỗ trợ');
  }
}

function assertManage(actor: SupportActor): void {
  if (!canManageSupport(actor)) {
    throw new DomainError('FORBIDDEN', 'Tài khoản chưa được cấp quyền xử lý yêu cầu hỗ trợ');
  }
}

// ---------- Tệp đính kèm ----------

type CheckedFile = SupportUpload & { kind: SupportFileKind; fileName: string };

/** Kiểm số tệp, cỡ tệp, loại tệp theo nội dung (T5). Sai thì báo lỗi rõ tệp nào. */
export function checkSupportFiles(files: readonly SupportUpload[]): CheckedFile[] {
  if (files.length > SUPPORT_MAX_FILES_PER_MESSAGE) {
    throw new DomainError(
      'VALIDATION',
      `Mỗi lần gửi tối đa ${SUPPORT_MAX_FILES_PER_MESSAGE} tệp đính kèm`,
    );
  }
  return files.map((file) => {
    if (file.bytes.byteLength > SUPPORT_MAX_FILE_BYTES) {
      throw new DomainError('VALIDATION', `Tệp ${file.name} lớn hơn 10 MB`);
    }
    if (file.bytes.byteLength === 0) {
      throw new DomainError('VALIDATION', `Tệp ${file.name} rỗng`);
    }
    const kind = detectSupportFile(file.bytes, file.name);
    if (!kind) {
      throw new DomainError(
        'VALIDATION',
        `Tệp ${file.name} không được nhận. Chỉ nhận ảnh, PDF, Excel hoặc Word`,
      );
    }
    return { ...file, kind, fileName: cleanFileName(file.name, kind) };
  });
}

async function storeFiles(
  requestId: string,
  messageId: string,
  files: readonly CheckedFile[],
  clientIds: readonly (string | null)[] = [],
): Promise<void> {
  for (const [index, file] of files.entries()) {
    const id = randomUUID();
    const storageKey = `${SUPPORT_FILE_PREFIX}${requestId}/${id}.${file.kind.extension}`;
    await putObject(storageKey, Buffer.from(file.bytes), file.kind.mimeType);
    await db.supportAttachment.create({
      data: {
        id,
        messageId,
        clientId: clientIds[index] ?? null,
        storageKey,
        fileName: file.fileName,
        mimeType: file.kind.mimeType,
        sizeBytes: file.bytes.byteLength,
        isImage: file.kind.isImage,
      },
    });
  }
}

// ---------- Mã yêu cầu, người nhận ----------

/** Mã HT-yyyy-nnnnn: mỗi năm một dải riêng, tạo dải khi gặp yêu cầu đầu tiên của năm. */
async function issueSupportCode(tx: Tx, now: Date): Promise<string> {
  const year = Number(new Date(now.getTime() + 7 * 3_600_000).toISOString().slice(0, 4));
  const key = supportSequenceKey(year);
  await tx.$executeRaw`
    INSERT INTO code_sequences (id, key, prefix, digits, range_start, range_end, next_value, updated_at)
    VALUES (gen_random_uuid(), ${key}, 'HT', 5, 1, 99999, 1, now())
    ON CONFLICT (key) DO NOTHING
  `;
  const rows = await tx.$queryRaw<Array<{ value: number }>>`
    UPDATE code_sequences SET next_value = next_value + 1, updated_at = now()
    WHERE key = ${key} AND next_value <= range_end
    RETURNING next_value - 1 AS value
  `;
  const row = rows[0];
  if (!row) throw new DomainError('CONFLICT', 'Dải mã yêu cầu hỗ trợ của năm nay đã dùng hết');
  return formatSupportCode(year, Number(row.value));
}

/**
 * Đơn vị của người gửi hoặc đơn vị cha có Quản trị đơn vị đang hoạt động thì yêu cầu vào hộp chung
 * của đơn vị; không có thì gửi thẳng Quản trị hệ thống (quyết định 29).
 */
async function hasUnitHandler(orgUnitId: string | null, requesterId: string): Promise<boolean> {
  if (!orgUnitId) return false;
  const unitIds = await getOrgUnitAncestorIds(orgUnitId);
  const handler = await db.user.findFirst({
    where: {
      // Không tính chính người gửi, để Quản trị đơn vị không nhận yêu cầu của mình.
      id: { not: requesterId },
      isActive: true,
      orgUnitId: { in: unitIds },
      roles: {
        some: {
          role: {
            dataScope: { in: ['ORG_UNIT', 'ORG_UNIT_TREE'] },
            permissions: { some: { code: MANAGE } },
          },
        },
      },
    },
    select: { id: true },
  });
  return handler !== null;
}

// ---------- Đọc yêu cầu ----------

const REQUEST_SELECT = {
  id: true,
  code: true,
  requesterId: true,
  orgUnitId: true,
  type: true,
  severity: true,
  title: true,
  status: true,
  level: true,
  assigneeId: true,
  context: true,
  escalationNote: true,
  firstResponseAt: true,
  firstResponseDueAt: true,
  resolveDueAt: true,
  resolvedAt: true,
  lastRequesterActivityAt: true,
  lastHandlerActivityAt: true,
  purgedAt: true,
  createdAt: true,
  updatedAt: true,
  requester: { select: { fullName: true, employeeCode: true } },
  orgUnit: { select: { name: true } },
  assignee: { select: { fullName: true } },
} satisfies Prisma.SupportRequestSelect;

type RequestRow = Prisma.SupportRequestGetPayload<{ select: typeof REQUEST_SELECT }>;

/** Bên xử lý được phép thao tác trên yêu cầu này: đúng cấp và trong phạm vi. */
function handlesLevel(actor: SupportActor, row: Pick<RequestRow, 'level'>): boolean {
  if (!canManageSupport(actor)) return false;
  return isSystemHandler(actor) || row.level === 'UNIT';
}

function lastActivity(row: RequestRow): Date {
  const handler = row.lastHandlerActivityAt?.getTime() ?? 0;
  return new Date(
    Math.max(row.lastRequesterActivityAt.getTime(), handler, row.updatedAt.getTime()),
  );
}

function needsReply(row: RequestRow): boolean {
  if (!OPEN_SUPPORT_STATUSES.includes(row.status)) return false;
  if (row.status === 'NEW') return true;
  return (
    row.lastHandlerActivityAt === null ||
    row.lastRequesterActivityAt.getTime() > row.lastHandlerActivityAt.getTime()
  );
}

function toSummary(
  row: RequestRow,
  viewerId: string,
  readAt: Date | undefined,
  dueSoonPercent: number,
  now: Date,
): SupportSummary {
  const isRequester = row.requesterId === viewerId;
  // Người gửi chưa đọc khi bên xử lý có hoạt động mới; bên xử lý chưa đọc khi người gửi có tin mới.
  const otherSide = isRequester ? row.lastHandlerActivityAt : row.lastRequesterActivityAt;
  const unread = otherSide !== null && (!readAt || otherSide.getTime() > readAt.getTime());
  const due = supportDueOf(row, dueSoonPercent, now);
  return {
    code: row.code,
    type: row.type,
    severity: row.severity,
    title: row.purgedAt ? 'Nội dung đã xoá sau 18 tháng' : row.title,
    status: row.status,
    level: row.level,
    requesterName: row.requester.fullName,
    requesterCode: row.requester.employeeCode,
    orgUnitName: row.orgUnit?.name ?? null,
    assigneeName: row.assignee?.fullName ?? null,
    createdAt: row.createdAt.toISOString(),
    lastActivityAt: lastActivity(row).toISOString(),
    unread,
    needsReply: needsReply(row),
    due: due ? { stage: due.stage, state: due.state, dueAt: due.dueAt.toISOString() } : null,
  };
}

async function readMarks(
  userId: string,
  requestIds: readonly string[],
): Promise<Map<string, Date>> {
  if (requestIds.length === 0) return new Map();
  const rows = await db.supportRead.findMany({
    where: { userId, requestId: { in: [...requestIds] } },
    select: { requestId: true, lastReadAt: true },
  });
  return new Map(rows.map((row) => [row.requestId, row.lastReadAt]));
}

async function dueSoonPercent(): Promise<number> {
  const row = await db.systemSetting.findUnique({
    where: { key: 'general' },
    select: { value: true },
  });
  return resolveSystemSettings(row?.value).supportDueSoonPercent;
}

export async function listMySupport(
  actor: SupportActor,
  scoped: ScopedDb,
  input: ListMySupportInput,
  now = new Date(),
): Promise<SupportListResult> {
  assertCreate(actor);
  const where = { requesterId: actor.id } satisfies Prisma.SupportRequestWhereInput;
  const [rows, total, percent] = await Promise.all([
    scoped.supportRequest.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
      select: REQUEST_SELECT,
    }),
    scoped.supportRequest.count({ where }),
    dueSoonPercent(),
  ]);
  const marks = await readMarks(
    actor.id,
    rows.map((row) => row.id),
  );
  return {
    items: rows.map((row) => toSummary(row, actor.id, marks.get(row.id), percent, now)),
    total,
    page: input.page,
    pageSize: input.pageSize,
  };
}

/** Điều kiện Cần xử lý theo cấp của người xem: chưa ai nhận, hoặc người gửi vừa trả lời. */
function pendingWhere(actor: SupportActor): Prisma.SupportRequestWhereInput {
  return {
    level: isSystemHandler(actor) ? 'SYSTEM' : 'UNIT',
    status: { in: ['NEW', 'IN_PROGRESS'] },
    OR: [
      { status: 'NEW' },
      { lastHandlerActivityAt: null },
      { lastHandlerActivityAt: { lt: db.supportRequest.fields.lastRequesterActivityAt } },
    ],
  };
}

/** Đang quá hạn: chưa phản hồi đầu mà quá hạn phản hồi, hoặc quá hạn xử lý. Chờ người gửi thì không tính. */
export function overdueWhere(now: Date): Prisma.SupportRequestWhereInput {
  return {
    status: { in: ['NEW', 'IN_PROGRESS'] },
    OR: [{ firstResponseAt: null, firstResponseDueAt: { lt: now } }, { resolveDueAt: { lt: now } }],
  };
}

function inboxWhere(
  actor: SupportActor,
  input: ListSupportInboxInput,
  now: Date,
): Prisma.SupportRequestWhereInput {
  const view: Prisma.SupportRequestWhereInput =
    input.view === 'PENDING'
      ? pendingWhere(actor)
      : input.view === 'MINE'
        ? { assigneeId: actor.id, status: { in: [...OPEN_SUPPORT_STATUSES] } }
        : input.view === 'OPEN'
          ? { status: { in: [...OPEN_SUPPORT_STATUSES] } }
          : {};
  const q = input.q?.trim();
  return {
    AND: [
      view,
      input.status ? { status: input.status } : {},
      input.type ? { type: input.type } : {},
      input.severity ? { severity: input.severity } : {},
      input.level ? { level: input.level } : {},
      input.overdue ? overdueWhere(now) : {},
      q
        ? {
            OR: [
              { code: { contains: q.toUpperCase() } },
              { title: { contains: q, mode: 'insensitive' } },
              { requester: { fullName: { contains: q, mode: 'insensitive' } } },
              { requester: { employeeCode: { contains: q.toUpperCase() } } },
            ],
          }
        : {},
    ],
  };
}

export async function listSupportInbox(
  actor: SupportActor,
  scoped: ScopedDb,
  input: ListSupportInboxInput,
  now = new Date(),
): Promise<SupportListResult> {
  assertManage(actor);
  const where = inboxWhere(actor, input, now);
  const orderBy: Prisma.SupportRequestOrderByWithRelationInput =
    input.view === 'PENDING' ? { lastRequesterActivityAt: 'asc' } : { updatedAt: 'desc' };
  const [rows, total, percent] = await Promise.all([
    scoped.supportRequest.findMany({
      where,
      orderBy,
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
      select: REQUEST_SELECT,
    }),
    scoped.supportRequest.count({ where }),
    dueSoonPercent(),
  ]);
  const marks = await readMarks(
    actor.id,
    rows.map((row) => row.id),
  );
  return {
    items: rows.map((row) => toSummary(row, actor.id, marks.get(row.id), percent, now)),
    total,
    page: input.page,
    pageSize: input.pageSize,
  };
}

/** Yêu cầu chính mình gửi có trả lời mới chưa đọc. */
export async function countMyUnread(actor: SupportActor, scoped: ScopedDb): Promise<number> {
  const rows = await scoped.supportRequest.findMany({
    where: { requesterId: actor.id, lastHandlerActivityAt: { not: null }, purgedAt: null },
    select: { id: true, lastHandlerActivityAt: true },
    orderBy: { updatedAt: 'desc' },
    take: 200,
  });
  const marks = await readMarks(
    actor.id,
    rows.map((row) => row.id),
  );
  return rows.filter((row) => {
    const readAt = marks.get(row.id);
    return row.lastHandlerActivityAt && (!readAt || row.lastHandlerActivityAt > readAt);
  }).length;
}

export type SupportButtonSummary = { unread: number; pending: number; overdue: number };

/** Số trên nút nổi Hỗ trợ (quyết định 32): trả lời mới của mình, việc chờ xử lý, quá hạn. */
export async function readSupportButtonSummary(
  actor: SupportActor,
  scoped: ScopedDb,
  now = new Date(),
): Promise<SupportButtonSummary> {
  const manage = canManageSupport(actor);
  const [unread, pending, overdue] = await Promise.all([
    actor.permissions.has(CREATE) && !isSystemHandler(actor) ? countMyUnread(actor, scoped) : 0,
    manage ? scoped.supportRequest.count({ where: pendingWhere(actor) }) : 0,
    manage ? scoped.supportRequest.count({ where: overdueWhere(now) }) : 0,
  ]);
  return { unread, pending, overdue };
}

/** Số đỏ: người gửi đếm yêu cầu có trả lời chưa đọc, bên xử lý đếm yêu cầu Cần xử lý ở cấp mình. */
export async function countSupportBadge(actor: SupportActor, scoped: ScopedDb): Promise<number> {
  if (canManageSupport(actor)) {
    return scoped.supportRequest.count({ where: pendingWhere(actor) });
  }
  if (!actor.permissions.has(CREATE)) return 0;
  const rows = await scoped.supportRequest.findMany({
    where: { requesterId: actor.id, lastHandlerActivityAt: { not: null }, purgedAt: null },
    select: { id: true, lastHandlerActivityAt: true },
    orderBy: { updatedAt: 'desc' },
    take: 200,
  });
  const marks = await readMarks(
    actor.id,
    rows.map((row) => row.id),
  );
  return rows.filter((row) => {
    const readAt = marks.get(row.id);
    return row.lastHandlerActivityAt && (!readAt || row.lastHandlerActivityAt > readAt);
  }).length;
}

/** Số yêu cầu đang quá hạn trong phạm vi, hiện ở Hub (T4). */
export async function countSupportOverdue(
  actor: SupportActor,
  scoped: ScopedDb,
  now = new Date(),
): Promise<number> {
  assertManage(actor);
  return scoped.supportRequest.count({ where: overdueWhere(now) });
}

/** Tìm yêu cầu trong phạm vi; người không xử lý chỉ được xem yêu cầu của chính mình. */
async function findVisible(
  actor: SupportActor,
  scoped: ScopedDb,
  code: string,
): Promise<RequestRow> {
  const row = await scoped.supportRequest.findUnique({ where: { code }, select: REQUEST_SELECT });
  if (!row || (row.requesterId !== actor.id && !canManageSupport(actor))) {
    throw new DomainError('NOT_FOUND', 'Không tìm thấy yêu cầu hỗ trợ hoặc bạn không có quyền xem');
  }
  return row;
}

function eventText(
  kind: SupportEventKind,
  fromStatus: SupportStatus | null,
  toStatus: SupportStatus | null,
  note: string,
): string {
  const tail = note ? `. ${note}` : '';
  switch (kind) {
    case 'CREATE':
      return 'Gửi yêu cầu';
    case 'CLAIM':
      return 'Nhận xử lý';
    case 'ESCALATE':
      return `Chuyển lên ${SUPPORT_LEVEL_LABEL.SYSTEM}${tail}`;
    case 'REOPEN':
      return 'Mở lại yêu cầu';
    case 'AUTO_CLOSE':
      return 'Tự đóng sau 7 ngày ở Đã xong';
    case 'STATUS':
      return `Đổi trạng thái${fromStatus ? ` từ ${SUPPORT_STATUS_LABEL[fromStatus]}` : ''} sang ${
        toStatus ? SUPPORT_STATUS_LABEL[toStatus] : ''
      }${tail}`;
  }
}

export type AttachmentLinkMode = 'presigned' | 'mobile';

export async function readSupportDetail(
  actor: SupportActor,
  scoped: ScopedDb,
  code: string,
  links: AttachmentLinkMode,
  now = new Date(),
): Promise<SupportDetail> {
  const row = await findVisible(actor, scoped, code);
  const [messages, events, marks, percent] = await Promise.all([
    db.supportMessage.findMany({
      where: { requestId: row.id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        clientId: true,
        authorId: true,
        fromRequester: true,
        body: true,
        createdAt: true,
        author: { select: { fullName: true } },
        attachments: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            fileName: true,
            mimeType: true,
            sizeBytes: true,
            isImage: true,
            storageKey: true,
          },
        },
      },
    }),
    db.supportEvent.findMany({
      where: { requestId: row.id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        kind: true,
        fromStatus: true,
        toStatus: true,
        note: true,
        createdAt: true,
        actor: { select: { fullName: true } },
      },
    }),
    readMarks(actor.id, [row.id]),
    dueSoonPercent(),
  ]);
  const isRequester = row.requesterId === actor.id;
  const handles = handlesLevel(actor, row);
  const open = OPEN_SUPPORT_STATUSES.includes(row.status);
  const context = supportContext.safeParse(row.context);
  return {
    ...toSummary(row, actor.id, marks.get(row.id), percent, now),
    context: context.success ? context.data : {},
    escalationNote: row.escalationNote,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    purged: row.purgedAt !== null,
    messages: messages.map((message) => ({
      id: message.id,
      clientId: message.clientId,
      authorName: message.author?.fullName ?? 'Tài khoản đã xoá',
      fromRequester: message.fromRequester,
      isMine: message.authorId === actor.id,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
      attachments: message.attachments.map((file) => ({
        id: file.id,
        fileName: file.fileName,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        isImage: file.isImage,
        url: links === 'presigned' ? presignGetUrl(file.storageKey) : null,
      })),
    })),
    events: events.map((event) => ({
      id: event.id,
      kind: event.kind,
      actorName: event.actor?.fullName ?? null,
      text: eventText(event.kind, event.fromStatus, event.toStatus, event.note),
      createdAt: event.createdAt.toISOString(),
    })),
    actions: {
      canReply:
        row.purgedAt === null &&
        (isRequester ? open : canManageSupport(actor) && row.status !== 'CLOSED'),
      canClaim: handles && open && row.assigneeId !== actor.id,
      canEscalate:
        canManageSupport(actor) && !isSystemHandler(actor) && row.level === 'UNIT' && open,
      canChangeStatus: handles && row.status !== 'CLOSED',
      canReopen: isRequester && canReopenSupport(row.status, row.resolvedAt, now),
    },
  };
}

export async function markSupportRead(
  actor: SupportActor,
  scoped: ScopedDb,
  code: string,
  now = new Date(),
) {
  const row = await findVisible(actor, scoped, code);
  await db.supportRead.upsert({
    where: { requestId_userId: { requestId: row.id, userId: actor.id } },
    create: { requestId: row.id, userId: actor.id, lastReadAt: now },
    update: { lastReadAt: now },
  });
}

/** Tệp cho app tải qua máy chủ (MinIO không mở ra ngoài). Chỉ người xem được yêu cầu mới tải được. */
export async function readSupportAttachment(
  actor: SupportActor,
  scoped: ScopedDb,
  attachmentId: string,
): Promise<{ body: Buffer; mimeType: string; fileName: string }> {
  const file = await db.supportAttachment.findUnique({
    where: { id: attachmentId },
    select: {
      storageKey: true,
      mimeType: true,
      fileName: true,
      message: { select: { request: { select: { code: true } } } },
    },
  });
  if (!file) throw new DomainError('NOT_FOUND', 'Không tìm thấy tệp');
  await findVisible(actor, scoped, file.message.request.code);
  const body = await getObject(file.storageKey);
  if (!body) throw new DomainError('NOT_FOUND', 'Tệp đã hết thời gian lưu');
  return { body, mimeType: file.mimeType, fileName: file.fileName };
}

// ---------- Ghi ----------

export type SupportMutation = {
  id: string;
  code: string;
  requesterId: string;
  orgUnitId: string | null;
  level: 'UNIT' | 'SYSTEM';
  /** Có tạo mới hay chỉ trả lại kết quả cũ (gửi lại cùng clientId). */
  created: boolean;
  warnings: string[];
  /** Phần đổi để ghi nhật ký thao tác. */
  changes: AuditChanges;
};

function changed(row: Pick<SupportMutation, 'code' | 'requesterId' | 'orgUnitId' | 'level'>) {
  void publishSupportChange({
    code: row.code,
    requesterId: row.requesterId,
    orgUnitId: row.orgUnitId,
    level: row.level,
  });
}

async function attachAfterCommit(
  requestId: string,
  messageId: string,
  files: readonly CheckedFile[],
): Promise<string[]> {
  if (files.length === 0) return [];
  try {
    await storeFiles(requestId, messageId, files);
    return [];
  } catch (error) {
    console.error('Không lưu được tệp hỗ trợ', error);
    return [
      'Đã gửi nội dung nhưng chưa lưu được tệp đính kèm, vui lòng gửi lại tệp trong phần trao đổi',
    ];
  }
}

export async function createSupportRequest(
  actor: SupportActor,
  input: CreateSupportRequestInput,
  uploads: readonly SupportUpload[] = [],
  now = new Date(),
): Promise<SupportMutation> {
  assertCreate(actor);
  if (isSystemHandler(actor)) {
    throw new DomainError(
      'FORBIDDEN',
      'Quản trị hệ thống nhận và xử lý yêu cầu ở trang Hỗ trợ trong Quản trị, không gửi yêu cầu cho chính mình',
    );
  }
  const files = checkSupportFiles(uploads);
  const existing = await db.supportRequest.findUnique({
    where: { requesterId_clientId: { requesterId: actor.id, clientId: input.clientId } },
    select: { id: true, code: true, requesterId: true, orgUnitId: true, level: true },
  });
  if (existing) return { ...existing, created: false, warnings: [], changes: {} };

  const [unitHandler, settingRow] = await Promise.all([
    canManageSupport(actor) ? Promise.resolve(false) : hasUnitHandler(actor.orgUnitId, actor.id),
    db.systemSetting.findUnique({ where: { key: 'general' }, select: { value: true } }),
  ]);
  const settings = resolveSystemSettings(settingRow?.value);
  const due = supportDueDates(now, input.type, input.severity ?? null, settings);
  const level = unitHandler ? 'UNIT' : 'SYSTEM';

  const { request, messageId } = await db.$transaction(async (tx) => {
    const code = await issueSupportCode(tx, now);
    const created = await tx.supportRequest.create({
      data: {
        code,
        clientId: input.clientId,
        requesterId: actor.id,
        orgUnitId: actor.orgUnitId,
        type: input.type,
        severity: input.severity ?? null,
        title: input.title,
        level,
        context: input.context,
        firstResponseDueAt: due.firstResponseDueAt,
        resolveDueAt: due.resolveDueAt,
        lastRequesterActivityAt: now,
        createdAt: now,
      },
      select: { id: true, code: true, requesterId: true, orgUnitId: true, level: true },
    });
    const message = await tx.supportMessage.create({
      data: {
        requestId: created.id,
        clientId: input.clientId,
        authorId: actor.id,
        fromRequester: true,
        body: input.body,
        createdAt: now,
      },
      select: { id: true },
    });
    await tx.supportEvent.create({
      data: {
        requestId: created.id,
        actorId: actor.id,
        kind: 'CREATE',
        toStatus: 'NEW',
        note:
          level === 'UNIT'
            ? ''
            : canManageSupport(actor)
              ? 'Quản trị đơn vị gửi, chuyển thẳng Quản trị hệ thống'
              : 'Đơn vị chưa có Quản trị đơn vị, gửi thẳng Quản trị hệ thống',
        createdAt: now,
      },
    });
    await tx.supportRead.create({
      data: { requestId: created.id, userId: actor.id, lastReadAt: now },
    });
    return { request: created, messageId: message.id };
  });
  const warnings = await attachAfterCommit(request.id, messageId, files);
  changed(request);
  const changes = auditChanges(
    {},
    {
      supportType: SUPPORT_TYPE_LABEL[input.type],
      status: SUPPORT_STATUS_LABEL.NEW,
      supportLevel: SUPPORT_LEVEL_LABEL[request.level],
    },
  );
  return { ...request, created: true, warnings, changes };
}

export async function replySupport(
  actor: SupportActor,
  scoped: ScopedDb,
  input: ReplySupportInput,
  uploads: readonly SupportUpload[] = [],
  now = new Date(),
  /** App gửi tệp sau tin nhắn: tin chưa có nội dung vẫn nhận. */
  filesFollow = false,
): Promise<SupportMutation & { messageId: string }> {
  const files = checkSupportFiles(uploads);
  const row = await findVisible(actor, scoped, input.code);
  const base = {
    id: row.id,
    code: row.code,
    requesterId: row.requesterId,
    orgUnitId: row.orgUnitId,
    level: row.level,
  };
  const existing = await db.supportMessage.findUnique({
    where: { requestId_clientId: { requestId: row.id, clientId: input.clientId } },
    select: { id: true },
  });
  if (existing)
    return { ...base, created: false, warnings: [], changes: {}, messageId: existing.id };
  if (!input.body && files.length === 0 && !filesFollow) {
    throw new DomainError('VALIDATION', 'Nhập nội dung hoặc đính kèm tệp', {
      body: 'Nhập nội dung',
    });
  }
  if (row.purgedAt) throw new DomainError('CONFLICT', 'Yêu cầu đã xoá nội dung sau 18 tháng');

  const isRequester = row.requesterId === actor.id;
  if (isRequester) {
    if (!OPEN_SUPPORT_STATUSES.includes(row.status)) {
      throw new DomainError('CONFLICT', 'Yêu cầu đã xong. Bấm Mở lại nếu vẫn chưa ổn');
    }
  } else if (!canManageSupport(actor) || row.status === 'CLOSED') {
    throw new DomainError('CONFLICT', 'Yêu cầu đã đóng, không trả lời thêm được');
  }

  const messageId = await db.$transaction(async (tx) => {
    const message = await tx.supportMessage.create({
      data: {
        requestId: row.id,
        clientId: input.clientId,
        authorId: actor.id,
        fromRequester: isRequester,
        body: input.body,
        createdAt: now,
      },
      select: { id: true },
    });
    if (isRequester) {
      // Người gửi trả lời khi đang Chờ người gửi thì yêu cầu quay về Đang xử lý.
      const nextStatus = row.status === 'WAITING_REQUESTER' ? 'IN_PROGRESS' : row.status;
      await tx.supportRequest.update({
        where: { id: row.id },
        data: { lastRequesterActivityAt: now, status: nextStatus },
      });
      if (nextStatus !== row.status) {
        await tx.supportEvent.create({
          data: {
            requestId: row.id,
            actorId: actor.id,
            kind: 'STATUS',
            fromStatus: row.status,
            toStatus: nextStatus,
            createdAt: now,
          },
        });
      }
    } else {
      // Bên xử lý trả lời yêu cầu Mới thì tự nhận xử lý.
      const claim = row.status === 'NEW' && handlesLevel(actor, row);
      await tx.supportRequest.update({
        where: { id: row.id },
        data: {
          lastHandlerActivityAt: now,
          firstResponseAt: row.firstResponseAt ?? now,
          ...(claim ? { status: 'IN_PROGRESS', assigneeId: row.assigneeId ?? actor.id } : {}),
        },
      });
      if (claim) {
        await tx.supportEvent.create({
          data: {
            requestId: row.id,
            actorId: actor.id,
            kind: 'CLAIM',
            fromStatus: 'NEW',
            toStatus: 'IN_PROGRESS',
            createdAt: now,
          },
        });
      }
    }
    await tx.supportRead.upsert({
      where: { requestId_userId: { requestId: row.id, userId: actor.id } },
      create: { requestId: row.id, userId: actor.id, lastReadAt: now },
      update: { lastReadAt: now },
    });
    return message.id;
  });
  const warnings = await attachAfterCommit(row.id, messageId, files);
  changed(base);
  return { ...base, created: true, warnings, changes: {}, messageId };
}

/** App gửi từng tệp sau tin nhắn; gửi lại cùng clientId của tệp thì không lưu thêm. */
export async function addSupportAttachment(
  actor: SupportActor,
  scoped: ScopedDb,
  code: string,
  messageClientId: string,
  attachmentClientId: string,
  upload: SupportUpload,
): Promise<{ created: boolean }> {
  const row = await findVisible(actor, scoped, code);
  const message = await db.supportMessage.findUnique({
    where: { requestId_clientId: { requestId: row.id, clientId: messageClientId } },
    select: { id: true, authorId: true, _count: { select: { attachments: true } } },
  });
  if (!message || message.authorId !== actor.id) {
    throw new DomainError('NOT_FOUND', 'Không tìm thấy tin nhắn để đính kèm tệp');
  }
  const existing = await db.supportAttachment.findUnique({
    where: { messageId_clientId: { messageId: message.id, clientId: attachmentClientId } },
    select: { id: true },
  });
  if (existing) return { created: false };
  if (message._count.attachments >= SUPPORT_MAX_FILES_PER_MESSAGE) {
    throw new DomainError(
      'VALIDATION',
      `Mỗi tin tối đa ${SUPPORT_MAX_FILES_PER_MESSAGE} tệp đính kèm`,
    );
  }
  const [file] = checkSupportFiles([upload]);
  if (!file) throw new DomainError('VALIDATION', 'Không có tệp');
  await storeFiles(row.id, message.id, [file], [attachmentClientId]);
  changed({
    code: row.code,
    requesterId: row.requesterId,
    orgUnitId: row.orgUnitId,
    level: row.level,
  });
  return { created: true };
}

type HandlerChange = {
  status?: SupportStatus;
  data: Prisma.SupportRequestUpdateInput;
  event: { kind: SupportEventKind; note?: string };
};

async function applyHandlerChange(
  actor: SupportActor,
  row: RequestRow,
  change: HandlerChange,
  now: Date,
): Promise<SupportMutation> {
  const toStatus = change.status ?? row.status;
  await db.$transaction(async (tx) => {
    await tx.supportRequest.update({ where: { id: row.id }, data: change.data });
    await tx.supportEvent.create({
      data: {
        requestId: row.id,
        actorId: actor.id,
        kind: change.event.kind,
        fromStatus: row.status,
        toStatus,
        note: change.event.note ?? '',
        createdAt: now,
      },
    });
  });
  const level = change.event.kind === 'ESCALATE' ? 'SYSTEM' : row.level;
  const result = {
    id: row.id,
    code: row.code,
    requesterId: row.requesterId,
    orgUnitId: row.orgUnitId,
    level,
  } as const;
  changed(result);
  const changes = auditChanges(
    { status: SUPPORT_STATUS_LABEL[row.status], supportLevel: SUPPORT_LEVEL_LABEL[row.level] },
    { status: SUPPORT_STATUS_LABEL[toStatus], supportLevel: SUPPORT_LEVEL_LABEL[level] },
  );
  return { ...result, created: true, warnings: [], changes };
}

export async function claimSupport(
  actor: SupportActor,
  scoped: ScopedDb,
  code: string,
  now = new Date(),
) {
  assertManage(actor);
  const row = await findVisible(actor, scoped, code);
  if (!handlesLevel(actor, row)) {
    throw new DomainError('FORBIDDEN', 'Yêu cầu đã chuyển lên Quản trị hệ thống');
  }
  if (!OPEN_SUPPORT_STATUSES.includes(row.status)) {
    throw new DomainError('CONFLICT', 'Yêu cầu đã xong, không nhận xử lý được');
  }
  const status = row.status === 'NEW' ? 'IN_PROGRESS' : row.status;
  return applyHandlerChange(
    actor,
    row,
    {
      status,
      data: { assignee: { connect: { id: actor.id } }, status },
      event: { kind: 'CLAIM' },
    },
    now,
  );
}

export async function escalateSupport(
  actor: SupportActor,
  scoped: ScopedDb,
  input: EscalateSupportInput,
  now = new Date(),
) {
  assertManage(actor);
  const row = await findVisible(actor, scoped, input.code);
  if (isSystemHandler(actor) || row.level !== 'UNIT') {
    throw new DomainError('CONFLICT', 'Yêu cầu đã ở Quản trị hệ thống');
  }
  if (!OPEN_SUPPORT_STATUSES.includes(row.status)) {
    throw new DomainError('CONFLICT', 'Yêu cầu đã xong, không chuyển lên được');
  }
  // Chuyển lên thì Quản trị hệ thống nhận như yêu cầu mới, chưa ai nhận.
  return applyHandlerChange(
    actor,
    row,
    {
      status: 'NEW',
      data: {
        level: 'SYSTEM',
        status: 'NEW',
        assignee: { disconnect: true },
        escalatedAt: now,
        escalationNote: input.note || null,
      },
      event: { kind: 'ESCALATE', note: input.note },
    },
    now,
  );
}

export async function changeSupportStatus(
  actor: SupportActor,
  scoped: ScopedDb,
  input: ChangeSupportStatusInput,
  now = new Date(),
) {
  assertManage(actor);
  const row = await findVisible(actor, scoped, input.code);
  if (!handlesLevel(actor, row)) {
    throw new DomainError('FORBIDDEN', 'Yêu cầu đã chuyển lên Quản trị hệ thống');
  }
  if (row.status === 'CLOSED') throw new DomainError('CONFLICT', 'Yêu cầu đã đóng');
  if (row.status === input.status) {
    throw new DomainError('CONFLICT', `Yêu cầu đang ở ${SUPPORT_STATUS_LABEL[row.status]}`);
  }
  return applyHandlerChange(
    actor,
    row,
    {
      status: input.status,
      data: {
        status: input.status,
        lastHandlerActivityAt: now,
        firstResponseAt: row.firstResponseAt ?? now,
        resolvedAt: input.status === 'DONE' ? now : null,
        ...(row.assigneeId ? {} : { assignee: { connect: { id: actor.id } } }),
      },
      event: { kind: 'STATUS', note: input.note },
    },
    now,
  );
}

export async function reopenSupport(
  actor: SupportActor,
  scoped: ScopedDb,
  code: string,
  now = new Date(),
) {
  const row = await findVisible(actor, scoped, code);
  if (row.requesterId !== actor.id) {
    throw new DomainError('FORBIDDEN', 'Chỉ người gửi mới mở lại được yêu cầu');
  }
  if (!canReopenSupport(row.status, row.resolvedAt, now)) {
    throw new DomainError('CONFLICT', 'Đã quá 7 ngày, vui lòng gửi yêu cầu mới');
  }
  const status = row.assigneeId ? 'IN_PROGRESS' : 'NEW';
  await db.$transaction(async (tx) => {
    await tx.supportRequest.update({
      where: { id: row.id },
      data: { status, resolvedAt: null, lastRequesterActivityAt: now },
    });
    await tx.supportEvent.create({
      data: {
        requestId: row.id,
        actorId: actor.id,
        kind: 'REOPEN',
        fromStatus: row.status,
        toStatus: status,
        createdAt: now,
      },
    });
  });
  const result = {
    id: row.id,
    code: row.code,
    requesterId: row.requesterId,
    orgUnitId: row.orgUnitId,
    level: row.level,
  };
  changed(result);
  return {
    ...result,
    created: true,
    warnings: [],
    changes: auditChanges(
      { status: SUPPORT_STATUS_LABEL[row.status] },
      { status: SUPPORT_STATUS_LABEL[status] },
    ),
  };
}

// ---------- Thống kê (T4) ----------

const STATS_LIMIT = 5000;
const HOUR_MS = 3_600_000;

type StatsRow = {
  type: SupportType;
  severity: SupportSeverity | null;
  status: SupportStatus;
  createdAt: Date;
  firstResponseAt: Date | null;
  firstResponseDueAt: Date | null;
  resolvedAt: Date | null;
  resolveDueAt: Date | null;
  orgUnit: { name: string } | null;
};

const average = (values: readonly number[]) =>
  values.length === 0
    ? null
    : Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;

const percent = (part: number, whole: number) =>
  whole === 0 ? null : Math.round((part / whole) * 100);

function isOverdue(row: StatsRow, now: Date): boolean {
  if (row.status !== 'NEW' && row.status !== 'IN_PROGRESS') return false;
  if (!row.firstResponseAt && row.firstResponseDueAt && row.firstResponseDueAt < now) return true;
  return Boolean(row.resolveDueAt && row.resolveDueAt < now);
}

function groupStats(
  rows: readonly StatsRow[],
  keyOf: (row: StatsRow) => string,
  now: Date,
): SupportStatsGroup[] {
  const groups = new Map<string, StatsRow[]>();
  for (const row of rows) groups.set(keyOf(row), [...(groups.get(keyOf(row)) ?? []), row]);
  return [...groups.entries()]
    .map(([label, items]) => ({
      label,
      total: items.length,
      open: items.filter((row) => OPEN_SUPPORT_STATUSES.includes(row.status)).length,
      overdue: items.filter((row) => isOverdue(row, now)).length,
      avgResolveHours: average(
        items.flatMap((row) =>
          row.resolvedAt ? [(row.resolvedAt.getTime() - row.createdAt.getTime()) / HOUR_MS] : [],
        ),
      ),
    }))
    .sort((a, b) => b.total - a.total);
}

/** Số liệu yêu cầu gửi trong kỳ, trong phạm vi người xem. */
export async function readSupportStats(
  actor: SupportActor,
  scoped: ScopedDb,
  period: SupportStatsPeriod,
  now = new Date(),
): Promise<SupportStats> {
  assertManage(actor);
  const from = new Date(now.getTime() - SUPPORT_STATS_PERIOD_DAYS[period] * 86_400_000);
  const rows: StatsRow[] = await scoped.supportRequest.findMany({
    where: { createdAt: { gte: from } },
    orderBy: { createdAt: 'desc' },
    take: STATS_LIMIT + 1,
    select: {
      type: true,
      severity: true,
      status: true,
      createdAt: true,
      firstResponseAt: true,
      firstResponseDueAt: true,
      resolvedAt: true,
      resolveDueAt: true,
      orgUnit: { select: { name: true } },
    },
  });
  const truncated = rows.length > STATS_LIMIT;
  const items = rows.slice(0, STATS_LIMIT);
  const responded = items.filter((row) => row.firstResponseAt);
  const resolved = items.filter((row) => row.resolvedAt);
  return {
    period,
    from: from.toISOString(),
    total: items.length,
    open: items.filter((row) => OPEN_SUPPORT_STATUSES.includes(row.status)).length,
    overdue: items.filter((row) => isOverdue(row, now)).length,
    done: items.filter((row) => row.status === 'DONE' || row.status === 'CLOSED').length,
    avgFirstResponseHours: average(
      responded.map(
        (row) => ((row.firstResponseAt?.getTime() ?? 0) - row.createdAt.getTime()) / HOUR_MS,
      ),
    ),
    avgResolveHours: average(
      resolved.map((row) => ((row.resolvedAt?.getTime() ?? 0) - row.createdAt.getTime()) / HOUR_MS),
    ),
    firstResponseOnTimePercent: percent(
      responded.filter(
        (row) =>
          row.firstResponseDueAt &&
          row.firstResponseAt &&
          row.firstResponseAt <= row.firstResponseDueAt,
      ).length,
      responded.length,
    ),
    resolveOnTimePercent: percent(
      resolved.filter(
        (row) => row.resolveDueAt && row.resolvedAt && row.resolvedAt <= row.resolveDueAt,
      ).length,
      resolved.length,
    ),
    byUnit: groupStats(items, (row) => row.orgUnit?.name ?? 'Chưa gán đơn vị', now),
    byType: groupStats(items, (row) => SUPPORT_TYPE_LABEL[row.type], now),
    bySeverity: groupStats(
      items.filter((row) => row.type === 'BUG'),
      (row) => (row.severity ? SUPPORT_SEVERITY_LABEL[row.severity] : 'Chưa chọn mức'),
      now,
    ),
    truncated,
  };
}

/** Bộ lọc sự kiện SSE theo người xem: yêu cầu của mình, hoặc yêu cầu trong phạm vi xử lý. */
export async function supportEventFilter(
  actor: SupportActor,
): Promise<(event: SupportChangeEvent) => boolean> {
  const manage = canManageSupport(actor);
  const unitIds =
    manage && actor.dataScope !== 'ALL' && actor.orgUnitId
      ? new Set(
          actor.dataScope === 'ORG_UNIT_TREE'
            ? await getOrgUnitTreeIds(actor.orgUnitId)
            : [actor.orgUnitId],
        )
      : null;
  return (event) => {
    if (event.requesterId === actor.id) return true;
    if (!manage) return false;
    if (actor.dataScope === 'ALL') return true;
    return event.orgUnitId !== null && unitIds !== null && unitIds.has(event.orgUnitId);
  };
}
