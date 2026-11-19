import { SUPPORT_REOPEN_DAYS, SUPPORT_RETENTION_MONTHS } from '@dms/contracts/support';
import { db } from '@dms/db/client';

// Việc định kỳ của Hỗ trợ (T5): tự đóng yêu cầu đã xong quá 7 ngày, xoá nội dung sau 18 tháng.
// Không báo Mattermost (bỏ ngày 19/11/2026); yêu cầu quá hạn hiện ở Hub và trang Hỗ trợ.

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
