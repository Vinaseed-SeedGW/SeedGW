import 'server-only';
import { after } from 'next/server';
import type {
  ListSupportInboxInput,
  SupportDetail,
  SupportListResult,
  SupportStats,
  SupportStatsRange,
} from '@seedgw/contracts/support';
import { assertCan, can } from '@/server/auth/can';
import { requireUser } from '@/server/auth/current-user';
import { getScopedDb } from '@/server/auth/scoped-db';
import {
  countSupportBadge,
  countSupportOverdue,
  listSupportInbox,
  markSupportRead,
  readSupportDetail,
  readSupportButtonSummary,
  readSupportStats,
  type SupportButtonSummary,
} from '@/server/services/support';

// Trang Quản trị › Hỗ trợ (T2). Khung nút nổi của nhân viên đọc qua Server Action ở actions/support.ts.

export async function getSupportInbox(input: ListSupportInboxInput): Promise<SupportListResult> {
  const user = await requireUser();
  assertCan(user, 'support.request.manage');
  return listSupportInbox(user, await getScopedDb(), input);
}

/** Chi tiết cho người xử lý; mở xem thì đánh dấu đã đọc sau khi trả trang. */
export async function getSupportDetailForHandler(code: string): Promise<SupportDetail> {
  const user = await requireUser();
  assertCan(user, 'support.request.manage');
  const scoped = await getScopedDb();
  const detail = await readSupportDetail(user, scoped, code, 'presigned');
  after(() => markSupportRead(user, scoped, code).catch(() => undefined));
  return detail;
}

/** Số yêu cầu Cần xử lý trên menu Quản trị; người không xử lý thì 0. */
export async function getSupportPendingCount(): Promise<number> {
  const user = await requireUser();
  if (!can(user, 'support.request.manage')) return 0;
  return countSupportBadge(user, await getScopedDb());
}

/** Số trên nút nổi Hỗ trợ. Lỗi thì trả 0 để không làm hỏng trang. */
export async function getSupportButtonSummary(): Promise<SupportButtonSummary> {
  const user = await requireUser();
  try {
    return await readSupportButtonSummary(user, await getScopedDb());
  } catch {
    return { unread: 0, pending: 0, overdue: 0 };
  }
}

/** Ô Yêu cầu hỗ trợ quá hạn trên Hub; null với người không xử lý hỗ trợ. */
export async function getSupportOverdueCount(): Promise<number | null> {
  const user = await requireUser();
  if (!can(user, 'support.request.manage')) return null;
  return countSupportOverdue(user, await getScopedDb());
}

export async function getSupportStats(range: SupportStatsRange): Promise<SupportStats> {
  const user = await requireUser();
  assertCan(user, 'support.request.manage');
  return readSupportStats(user, await getScopedDb(), range);
}
