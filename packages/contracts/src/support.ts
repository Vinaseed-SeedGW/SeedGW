import { z } from 'zod';
import { MAX_PAGE_SIZE, pageResult } from './common';

// Hỗ trợ (T1 tới T5, quyết định 29, 30): CBNV gửi yêu cầu cho Quản trị đơn vị, chuyển lên Quản trị hệ thống.

export const supportType = z.enum(['QUESTION', 'BUG', 'FEEDBACK']);
export type SupportType = z.infer<typeof supportType>;
export const SUPPORT_TYPE_LABEL: Record<SupportType, string> = {
  QUESTION: 'Hỏi đáp',
  BUG: 'Báo lỗi',
  FEEDBACK: 'Góp ý',
};

export const supportSeverity = z.enum(['BLOCKER', 'MAJOR', 'MINOR']);
export type SupportSeverity = z.infer<typeof supportSeverity>;
export const SUPPORT_SEVERITY_LABEL: Record<SupportSeverity, string> = {
  BLOCKER: 'Chặn công việc',
  MAJOR: 'Ảnh hưởng',
  MINOR: 'Nhẹ',
};

export const supportStatus = z.enum(['NEW', 'IN_PROGRESS', 'WAITING_REQUESTER', 'DONE', 'CLOSED']);
export type SupportStatus = z.infer<typeof supportStatus>;
export const SUPPORT_STATUS_LABEL: Record<SupportStatus, string> = {
  NEW: 'Mới',
  IN_PROGRESS: 'Đang xử lý',
  WAITING_REQUESTER: 'Chờ người gửi',
  DONE: 'Đã xong',
  CLOSED: 'Đã đóng',
};
export const OPEN_SUPPORT_STATUSES: readonly SupportStatus[] = [
  'NEW',
  'IN_PROGRESS',
  'WAITING_REQUESTER',
];

/** Trạng thái người xử lý được chọn tay. Mới và Đã đóng do hệ thống đặt. */
export const supportManualStatus = z.enum(['IN_PROGRESS', 'WAITING_REQUESTER', 'DONE']);
export type SupportManualStatus = z.infer<typeof supportManualStatus>;

export const supportLevel = z.enum(['UNIT', 'SYSTEM']);
export type SupportLevel = z.infer<typeof supportLevel>;
export const SUPPORT_LEVEL_LABEL: Record<SupportLevel, string> = {
  UNIT: 'Quản trị đơn vị',
  SYSTEM: 'Quản trị hệ thống',
};

export const supportEventKind = z.enum([
  'CREATE',
  'CLAIM',
  'ESCALATE',
  'STATUS',
  'REOPEN',
  'AUTO_CLOSE',
]);
export type SupportEventKind = z.infer<typeof supportEventKind>;

/** Người gửi bấm Mở lại trong 7 ngày sau Đã xong; quá 7 ngày thì tự đóng. */
export const SUPPORT_REOPEN_DAYS = 7;
/** Nội dung và tệp lưu 18 tháng như check-in, rồi tự xoá. */
export const SUPPORT_RETENTION_MONTHS = 18;
export const SUPPORT_TITLE_MAX = 120;
export const SUPPORT_BODY_MAX = 4000;
export const SUPPORT_PAGE_SIZE = 20;

/** Mã yêu cầu HT-yyyy-nnnnn, đánh số lại từ 1 mỗi năm. */
export function formatSupportCode(year: number, value: number): string {
  return `HT-${year}-${String(value).padStart(5, '0')}`;
}

export function supportSequenceKey(year: number): string {
  return `support-request-${year}`;
}

export function isSupportCode(value: string): boolean {
  return /^HT-\d{4}-\d{5}$/.test(value);
}

/** Còn trong 7 ngày được Mở lại sau Đã xong. */
export function canReopenSupport(
  status: SupportStatus,
  resolvedAt: Date | null,
  now = new Date(),
): boolean {
  if (status !== 'DONE' || !resolvedAt) return false;
  return now.getTime() - resolvedAt.getTime() <= SUPPORT_REOPEN_DAYS * 86_400_000;
}

// Ngữ cảnh tự gắn: trang web đang mở, hoặc phiên bản app, loại máy, màn hình trên app.
export const supportContext = z.object({
  page: z.string().trim().max(300).optional(),
  appVersion: z.string().trim().max(60).optional(),
  platform: z.string().trim().max(30).optional(),
  device: z.string().trim().max(120).optional(),
  screen: z.string().trim().max(120).optional(),
  failedClientId: z.string().trim().max(60).optional(),
});
export type SupportContext = z.infer<typeof supportContext>;

const titleField = z
  .string()
  .trim()
  .min(3, 'Tiêu đề cần ít nhất 3 ký tự')
  .max(SUPPORT_TITLE_MAX, `Tiêu đề tối đa ${SUPPORT_TITLE_MAX} ký tự`);
const bodyField = z
  .string()
  .trim()
  .max(SUPPORT_BODY_MAX, `Nội dung tối đa ${SUPPORT_BODY_MAX} ký tự`);

export const createSupportRequestInput = z
  .object({
    clientId: z.uuid(),
    type: supportType,
    severity: supportSeverity.optional(),
    title: titleField,
    body: bodyField.min(1, 'Nhập nội dung yêu cầu'),
    context: supportContext.default({}),
  })
  .superRefine((value, ctx) => {
    if (value.type === 'BUG' && !value.severity) {
      ctx.addIssue({ code: 'custom', path: ['severity'], message: 'Chọn mức độ của lỗi' });
    }
  })
  .transform((value) => ({
    ...value,
    // Mức độ chỉ có ý nghĩa với Báo lỗi; loại khác tính thời hạn như mức Nhẹ.
    severity: value.type === 'BUG' ? value.severity : undefined,
  }));
export type CreateSupportRequestInput = z.infer<typeof createSupportRequestInput>;

export const replySupportInput = z.object({
  code: z.string().refine(isSupportCode, 'Mã yêu cầu không đúng'),
  clientId: z.uuid(),
  body: bodyField,
});
export type ReplySupportInput = z.infer<typeof replySupportInput>;

export const supportCodeInput = z.object({
  code: z.string().refine(isSupportCode, 'Mã yêu cầu không đúng'),
});

export const escalateSupportInput = supportCodeInput.extend({
  note: z.string().trim().max(500, 'Ghi chú tối đa 500 ký tự').default(''),
});
export type EscalateSupportInput = z.infer<typeof escalateSupportInput>;

export const changeSupportStatusInput = supportCodeInput.extend({
  status: supportManualStatus,
  note: z.string().trim().max(500, 'Ghi chú tối đa 500 ký tự').default(''),
});
export type ChangeSupportStatusInput = z.infer<typeof changeSupportStatusInput>;

// ---------- Hiển thị ----------

export const supportAttachmentView = z.object({
  id: z.string(),
  fileName: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int(),
  isImage: z.boolean(),
  /** Link xem có hạn trên web; app tải qua API riêng. */
  url: z.string().nullable(),
});
export type SupportAttachmentView = z.infer<typeof supportAttachmentView>;

export const supportMessageView = z.object({
  id: z.string(),
  clientId: z.string(),
  authorName: z.string(),
  /** Tin của người gửi yêu cầu hay của bên xử lý, để canh trái phải. */
  fromRequester: z.boolean(),
  isMine: z.boolean(),
  body: z.string(),
  createdAt: z.iso.datetime(),
  attachments: z.array(supportAttachmentView),
});
export type SupportMessageView = z.infer<typeof supportMessageView>;

export const supportEventView = z.object({
  id: z.string(),
  kind: supportEventKind,
  actorName: z.string().nullable(),
  text: z.string(),
  createdAt: z.iso.datetime(),
});
export type SupportEventView = z.infer<typeof supportEventView>;

export const supportDueState = z.enum(['ON_TIME', 'DUE_SOON', 'OVERDUE']);
export type SupportDueState = z.infer<typeof supportDueState>;
export const SUPPORT_DUE_LABEL: Record<SupportDueState, string> = {
  ON_TIME: 'Trong hạn',
  DUE_SOON: 'Sắp quá hạn',
  OVERDUE: 'Quá hạn',
};

export const supportDueView = z.object({
  state: supportDueState,
  /** Mốc đang tính: phản hồi đầu hay xử lý xong. */
  stage: z.enum(['FIRST_RESPONSE', 'RESOLVE']),
  dueAt: z.iso.datetime(),
});
export type SupportDueView = z.infer<typeof supportDueView>;

export const supportSummary = z.object({
  code: z.string(),
  type: supportType,
  severity: supportSeverity.nullable(),
  title: z.string(),
  status: supportStatus,
  level: supportLevel,
  requesterName: z.string(),
  requesterCode: z.string(),
  orgUnitName: z.string().nullable(),
  assigneeName: z.string().nullable(),
  createdAt: z.iso.datetime(),
  lastActivityAt: z.iso.datetime(),
  unread: z.boolean(),
  /** Người gửi vừa trả lời, bên xử lý chưa trả lời lại. */
  needsReply: z.boolean(),
  due: supportDueView.nullable(),
});
export type SupportSummary = z.infer<typeof supportSummary>;

export const supportDetail = supportSummary.extend({
  context: supportContext,
  escalationNote: z.string().nullable(),
  resolvedAt: z.iso.datetime().nullable(),
  purged: z.boolean(),
  messages: z.array(supportMessageView),
  events: z.array(supportEventView),
  actions: z.object({
    canReply: z.boolean(),
    canClaim: z.boolean(),
    canEscalate: z.boolean(),
    canChangeStatus: z.boolean(),
    canReopen: z.boolean(),
  }),
});
export type SupportDetail = z.infer<typeof supportDetail>;

// ---------- Danh sách ----------

export const listMySupportInput = z.object({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(MAX_PAGE_SIZE).default(SUPPORT_PAGE_SIZE),
});
export type ListMySupportInput = z.infer<typeof listMySupportInput>;

export const supportListResult = pageResult(supportSummary);
export type SupportListResult = z.infer<typeof supportListResult>;

export const supportInboxView = z.enum(['PENDING', 'MINE', 'OPEN', 'ALL']);
export type SupportInboxView = z.infer<typeof supportInboxView>;
export const SUPPORT_INBOX_VIEW_LABEL: Record<SupportInboxView, string> = {
  PENDING: 'Cần xử lý',
  MINE: 'Tôi nhận',
  OPEN: 'Đang mở',
  ALL: 'Tất cả',
};
const INBOX_VIEW_SLUG: Record<SupportInboxView, string> = {
  PENDING: 'can-xu-ly',
  MINE: 'toi-nhan',
  OPEN: 'dang-mo',
  ALL: 'tat-ca',
};

export const listSupportInboxInput = z.object({
  view: supportInboxView.default('PENDING'),
  q: z.string().trim().max(100).optional(),
  status: supportStatus.optional(),
  type: supportType.optional(),
  severity: supportSeverity.optional(),
  level: supportLevel.optional(),
  /** Chỉ yêu cầu đang quá hạn phản hồi đầu hoặc hạn xử lý (T4). */
  overdue: z.boolean().default(false),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(MAX_PAGE_SIZE).default(SUPPORT_PAGE_SIZE),
});
export type ListSupportInboxInput = z.infer<typeof listSupportInboxInput>;

const LEVEL_SLUG: Record<SupportLevel, string> = { UNIT: 'don-vi', SYSTEM: 'he-thong' };
const slugEnum = <T extends string>(map: Record<T, string>) =>
  z
    .string()
    .optional()
    .transform((value) => {
      const hit = (Object.entries(map) as Array<[T, string]>).find(([, slug]) => slug === value);
      return hit?.[0];
    })
    .catch(undefined);

// Tham số URL tiếng Việt cho trang Quản trị › Hỗ trợ (IA §9).
export const supportInboxUrlParams = z
  .object({
    xem: slugEnum(INBOX_VIEW_SLUG),
    q: z.string().trim().max(100).optional().catch(undefined),
    'trang-thai': supportStatus.optional().catch(undefined),
    loai: supportType.optional().catch(undefined),
    'muc-do': supportSeverity.optional().catch(undefined),
    cap: slugEnum(LEVEL_SLUG),
    han: z.enum(['qua-han']).optional().catch(undefined),
    trang: z.coerce.number().int().positive().catch(1),
  })
  .transform((url): ListSupportInboxInput => ({
    view: url.xem ?? 'PENDING',
    q: url.q || undefined,
    status: url['trang-thai'],
    type: url.loai,
    severity: url['muc-do'],
    level: url.cap,
    overdue: url.han === 'qua-han',
    page: url.trang,
    pageSize: SUPPORT_PAGE_SIZE,
  }));

export function supportInboxViewSlug(view: SupportInboxView): string {
  return INBOX_VIEW_SLUG[view];
}

export function supportLevelSlug(level: SupportLevel): string {
  return LEVEL_SLUG[level];
}

/** Số đỏ: trả lời chưa đọc với người gửi, việc chờ xử lý với quản trị. */
export const supportBadge = z.object({ count: z.number().int().nonnegative() });
export type SupportBadge = z.infer<typeof supportBadge>;

/** Sự kiện đẩy qua SSE khi một yêu cầu thay đổi; trang tự tải lại phần liên quan. */
export type SupportChangeEvent = {
  code: string;
  requesterId: string;
  orgUnitId: string | null;
  level: SupportLevel;
};
export const SUPPORT_EVENTS_CHANNEL = 'support-events';

/** Ô nhập của form tạo yêu cầu trên web; mã clientId và ngữ cảnh gắn lúc gửi. */
export const supportRequestForm = z
  .object({
    type: supportType,
    severity: supportSeverity.nullable(),
    title: titleField,
    body: bodyField.min(1, 'Nhập nội dung yêu cầu'),
  })
  .superRefine((value, ctx) => {
    if (value.type === 'BUG' && !value.severity) {
      ctx.addIssue({ code: 'custom', path: ['severity'], message: 'Chọn mức độ của lỗi' });
    }
  });
export type SupportRequestForm = z.infer<typeof supportRequestForm>;

// ---------- Thống kê (T4) ----------

export const supportStatsPeriod = z.enum(['30-ngay', '90-ngay', '12-thang']);
export type SupportStatsPeriod = z.infer<typeof supportStatsPeriod>;
export const SUPPORT_STATS_PERIOD_LABEL: Record<SupportStatsPeriod, string> = {
  '30-ngay': '30 ngày',
  '90-ngay': '90 ngày',
  '12-thang': '12 tháng',
};
export const SUPPORT_STATS_PERIOD_DAYS: Record<SupportStatsPeriod, number> = {
  '30-ngay': 30,
  '90-ngay': 90,
  '12-thang': 365,
};
export const supportStatsUrlParams = z.object({
  ky: supportStatsPeriod.catch('30-ngay').default('30-ngay'),
});

export type SupportStatsGroup = {
  label: string;
  total: number;
  open: number;
  overdue: number;
  /** Giờ trung bình từ lúc gửi tới Đã xong, tính liền cả ngoài giờ. */
  avgResolveHours: number | null;
};

export type SupportStats = {
  period: SupportStatsPeriod;
  from: string;
  total: number;
  open: number;
  overdue: number;
  done: number;
  avgFirstResponseHours: number | null;
  avgResolveHours: number | null;
  firstResponseOnTimePercent: number | null;
  resolveOnTimePercent: number | null;
  byUnit: SupportStatsGroup[];
  byType: SupportStatsGroup[];
  bySeverity: SupportStatsGroup[];
  /** Có bị cắt bớt vì quá nhiều yêu cầu trong kỳ không. */
  truncated: boolean;
};
