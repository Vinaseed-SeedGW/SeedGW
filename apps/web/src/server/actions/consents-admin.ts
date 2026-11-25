'use server';

import type { ActionResult, ExportedFile } from '@seedgw/contracts/common';
import { MAX_EXPORT_ROWS } from '@seedgw/contracts/common';
import {
  CONSENT_CHANNEL_LABEL,
  CONSENT_STATUS_LABEL,
  exportConsentStatusInput,
  type ConsentStatusRow,
} from '@seedgw/contracts/consents';
import { formatDateTime } from '@seedgw/contracts/format';
import { toActionError, validationError } from '@/server/auth/action-error';
import { assertCan } from '@/server/auth/can';
import { requireUser } from '@/server/auth/current-user';
import { getScopedDb } from '@/server/auth/scoped-db';
import {
  CONSENT_STATUS_SELECT,
  consentStatusWhere,
  toConsentStatusRow,
} from '@/server/queries/consents';
import { buildWorkbookBase64, type ExcelColumn } from '@/server/services/excel';

const COLUMNS: ReadonlyArray<ExcelColumn<ConsentStatusRow>> = [
  { header: 'Mã nhân viên', width: 16, value: (row) => row.employeeCode },
  { header: 'Họ tên', width: 30, value: (row) => row.fullName },
  { header: 'Đơn vị', width: 30, value: (row) => row.orgUnitName ?? '' },
  { header: 'Tình trạng', width: 16, value: (row) => CONSENT_STATUS_LABEL[row.status] },
  {
    header: 'Thời điểm gần nhất',
    width: 20,
    value: (row) => (row.lastAt ? formatDateTime(row.lastAt) : ''),
  },
  {
    header: 'Kênh',
    width: 26,
    value: (row) => (row.lastChannel ? CONSENT_CHANNEL_LABEL[row.lastChannel] : ''),
  },
];

/** Xuất tình trạng đồng ý để lưu hồ sơ; chi tiết từng lần xem ở giấy xác nhận. */
export async function exportConsentStatusAction(raw: unknown): Promise<ActionResult<ExportedFile>> {
  try {
    const user = await requireUser();
    assertCan(user, 'admin.user.export');
    const parsed = exportConsentStatusInput.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);

    const scoped = await getScopedDb();
    const where = consentStatusWhere(parsed.data);
    if ((await scoped.user.count({ where })) > MAX_EXPORT_ROWS) {
      return {
        ok: false,
        code: 'CONFLICT',
        message: 'Có quá nhiều dòng để xuất. Vui lòng thu hẹp bộ lọc.',
      };
    }
    const rows = await scoped.user.findMany({
      where,
      orderBy: [{ employeeCode: 'asc' }, { id: 'asc' }],
      select: CONSENT_STATUS_SELECT,
    });
    const base64 = await buildWorkbookBase64(
      'Đồng ý dữ liệu',
      COLUMNS,
      rows.map(toConsentStatusRow),
    );
    return { ok: true, data: { fileName: 'dong-y-du-lieu-ca-nhan.xlsx', base64 } };
  } catch (error) {
    return toActionError(error);
  }
}
