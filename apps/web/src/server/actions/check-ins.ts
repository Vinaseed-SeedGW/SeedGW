'use server';

import { z } from 'zod';
import { exportCheckInsInput } from '@seedgw/contracts/check-ins';
import { MAX_EXPORT_ROWS, type ActionResult, type ExportedFile } from '@seedgw/contracts/common';
import { toActionError, validationError } from '@/server/auth/action-error';
import { assertCan } from '@/server/auth/can';
import { requireUser } from '@/server/auth/current-user';
import { getScopedDb } from '@/server/auth/scoped-db';
import {
  buildCheckInWorkbook,
  CHECK_IN_ORDER_BY,
  CHECK_IN_ROW_SELECT,
  checkInWhere,
  toCheckInRow,
} from '@/server/services/check-in-report';

const exportRequest = z.object({
  filter: exportCheckInsInput,
  ids: z.array(z.uuid()).max(MAX_EXPORT_ROWS),
});

/** Xuất đúng bộ lọc đang xem, hoặc chỉ các dòng đã chọn. Phạm vi dữ liệu áp ngay trong truy vấn. */
export async function exportCheckInsAction(
  rawFilter: unknown,
  rawIds: unknown,
): Promise<ActionResult<ExportedFile>> {
  try {
    const user = await requireUser();
    assertCan(user, 'sales.check-in.read');

    const parsed = exportRequest.safeParse({ filter: rawFilter, ids: rawIds });
    if (!parsed.success) return validationError(parsed.error);
    const { filter, ids } = parsed.data;

    const scoped = await getScopedDb();
    const where = { ...checkInWhere(filter), ...(ids.length > 0 ? { id: { in: ids } } : {}) };
    const total = await scoped.checkIn.count({ where });
    if (total > MAX_EXPORT_ROWS) {
      return {
        ok: false,
        code: 'CONFLICT',
        message: 'Có quá nhiều dòng để xuất. Vui lòng thu hẹp khoảng ngày hoặc bộ lọc.',
      };
    }

    const rows = await scoped.checkIn.findMany({
      where,
      orderBy: CHECK_IN_ORDER_BY,
      select: CHECK_IN_ROW_SELECT,
    });
    const base64 = await buildCheckInWorkbook(
      rows.map((row) => toCheckInRow(row)),
      filter,
    );
    const suffix = filter.from === filter.to ? filter.from : `${filter.from}_${filter.to}`;
    return { ok: true, data: { fileName: `bao-cao-cu-ly-di-chuyen_${suffix}.xlsx`, base64 } };
  } catch (error) {
    return toActionError(error);
  }
}
