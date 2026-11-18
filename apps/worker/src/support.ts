import {
  SUPPORT_REOPEN_DAYS,
  SUPPORT_RETENTION_MONTHS,
  SUPPORT_SEVERITY_LABEL,
} from '@dms/contracts/support';
import { db } from '@dms/db/client';

// Việc định kỳ của Hỗ trợ (T4, T5): tự đóng yêu cầu đã xong quá 7 ngày, xoá nội dung sau 18 tháng,
// tìm Báo lỗi chặn công việc quá hạn để báo Mattermost.

const DAY_MS = 86_400_000;

export async function autoCloseDone(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - SUPPORT_REOPEN_DAYS * DAY_MS);
  const rows = await db.supportRequest.findMany({
    where: { status: 'DONE', resolvedAt: { lt: cutoff } },
    select: { id: true },
    take: 500,
  });
  for (const row of rows) {
    await db.$transaction([
      db.supportRequest.update({
        where: { id: row.id },
        data: { status: 'CLOSED', closedAt: now },
      }),
      db.supportEvent.create({
        data: {
          requestId: row.id,
          kind: 'AUTO_CLOSE',
          fromStatus: 'DONE',
          toStatus: 'CLOSED',
          createdAt: now,
        },
      }),
    ]);
  }
  return rows.length;
}

/** Mốc 18 tháng trước theo lịch (không phải 540 ngày), để khớp cách lưu check-in. */
export function retentionCutoff(now: Date): Date {
  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - SUPPORT_RETENTION_MONTHS);
  return cutoff;
}

/**
 * Xoá tin trao đổi, tệp và tiêu đề của yêu cầu quá 18 tháng; giữ mã, loại, đơn vị, các mốc giờ để
 * thống kê. Tệp trong kho MinIO tự xoá theo luật lưu 548 ngày của thư mục support/.
 */
export async function purgeExpired(now = new Date()): Promise<number> {
  const rows = await db.supportRequest.findMany({
    where: { createdAt: { lt: retentionCutoff(now) }, purgedAt: null },
    select: { id: true },
    take: 200,
  });
  for (const row of rows) {
    await db.$transaction([
      db.supportMessage.deleteMany({ where: { requestId: row.id } }),
      db.supportEvent.updateMany({ where: { requestId: row.id }, data: { note: '' } }),
      db.supportRequest.update({
        where: { id: row.id },
        data: { title: '', context: {}, escalationNote: null, purgedAt: now },
      }),
    ]);
  }
  return rows.length;
}

export type OverdueAlert = { key: string; text: string; requestId: string };

/** Báo lỗi chặn công việc đang mở đã quá hạn phản hồi đầu hoặc hạn xử lý, chưa báo lần nào. */
export async function findOverdueBlockers(now = new Date()): Promise<OverdueAlert[]> {
  const rows = await db.supportRequest.findMany({
    where: {
      type: 'BUG',
      severity: 'BLOCKER',
      status: { in: ['NEW', 'IN_PROGRESS'] },
      overdueAlertedAt: null,
      OR: [
        { firstResponseAt: null, firstResponseDueAt: { lt: now } },
        { resolveDueAt: { lt: now } },
      ],
    },
    select: {
      id: true,
      code: true,
      title: true,
      firstResponseAt: true,
      requester: { select: { fullName: true, employeeCode: true } },
      orgUnit: { select: { name: true } },
      assignee: { select: { fullName: true } },
    },
    take: 50,
  });
  const base = (process.env.AUTH_URL ?? '').replace(/\/$/, '');
  return rows.map((row) => {
    const stage = row.firstResponseAt ? 'quá hạn xử lý' : 'chưa phản hồi, quá hạn';
    const link = base ? ` ${base}/quan-tri/ho-tro/${row.code}` : '';
    return {
      key: `support-overdue:${row.id}`,
      requestId: row.id,
      text:
        `Báo lỗi ${SUPPORT_SEVERITY_LABEL.BLOCKER.toLowerCase()} ${stage}: ${row.code}, ${row.title}. ` +
        `Người gửi ${row.requester.fullName} (${row.requester.employeeCode})` +
        `${row.orgUnit ? `, ${row.orgUnit.name}` : ''}. ` +
        `${row.assignee ? `Đang giao ${row.assignee.fullName}.` : 'Chưa ai nhận.'}${link}`,
    };
  });
}

export async function markAlerted(requestId: string, now = new Date()): Promise<void> {
  await db.supportRequest.update({ where: { id: requestId }, data: { overdueAlertedAt: now } });
}
