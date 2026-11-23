'use server';

import type { ActionResult, ExportedFile } from '@seedgw/contracts/common';
import { DEALER_LEVEL_LABEL } from '@seedgw/contracts/dealers';
import { formatDate } from '@seedgw/contracts/format';
import {
  MAX_REPORT_EXPORT_ROWS,
  ratioPercent,
  REPORT_GROUP_LABEL,
  reportUrlParams,
  type ReportTarget,
} from '@seedgw/contracts/reports';
import { toActionError } from '@/server/auth/action-error';
import { assertCan } from '@/server/auth/can';
import { requireUser } from '@/server/auth/current-user';
import { buildWorkbookBase64, type ExcelColumn } from '@/server/services/excel';
import { readReport } from '@/server/services/reports';
import { listSeasons } from '@/server/services/seasons';

function percentText(part: number, whole: number | null | undefined): string | number {
  const value = whole ? ratioPercent(part, whole) : null;
  return value === null ? '' : value;
}

function targetCells<
  T extends { visits: number; dealersVisited: number; target: ReportTarget | null },
>(): ExcelColumn<T>[] {
  return [
    { header: 'Chỉ tiêu lượt', width: 14, value: (row) => row.target?.visitCountTarget ?? '' },
    {
      header: '% lượt',
      width: 10,
      value: (row) => percentText(row.visits, row.target?.visitCountTarget),
    },
    {
      header: 'Chỉ tiêu đại lý',
      width: 14,
      value: (row) => row.target?.dealerCoverageTarget ?? '',
    },
    {
      header: '% đại lý',
      width: 10,
      value: (row) => percentText(row.dealersVisited, row.target?.dealerCoverageTarget),
    },
  ];
}

/** Xuất Excel đúng bảng đang xem (cùng kỳ, bộ lọc, phạm vi dữ liệu), không chia trang. */
export async function exportReportAction(
  params: Record<string, string>,
): Promise<ActionResult<ExportedFile>> {
  try {
    const user = await requireUser();
    assertCan(user, 'sales.report.read');
    const input = reportUrlParams(new Date(), await listSeasons()).parse(params);
    const result = await readReport({ ...input, page: 1, pageSize: MAX_REPORT_EXPORT_ROWS }, true);
    const fileName = `bao-cao-${input.group}-${input.from}-${input.to}.xlsx`;
    const sheet = `${REPORT_GROUP_LABEL[input.group]}`;
    let base64: string;
    if (result.group === 'nhan-vien') {
      base64 = await buildWorkbookBase64(
        sheet,
        [
          { header: 'Mã nhân viên', width: 14, value: (row) => row.code, numberFormat: '@' },
          { header: 'Họ tên', width: 28, value: (row) => row.name },
          { header: 'Đơn vị', width: 30, value: (row) => row.orgUnitName ?? '' },
          { header: 'Lượt ghé thăm', width: 14, value: (row) => row.visits },
          { header: 'Đại lý được ghé', width: 14, value: (row) => row.dealersVisited },
          { header: 'Đại lý phụ trách', width: 14, value: (row) => row.assignedDealers },
          { header: 'Phụ trách đã ghé', width: 14, value: (row) => row.assignedVisited },
          {
            header: '% độ phủ phụ trách',
            width: 14,
            value: (row) => percentText(row.assignedVisited, row.assignedDealers),
          },
          { header: 'Km', width: 10, value: (row) => row.km },
          ...targetCells<(typeof result.rows)[number]>(),
          { header: 'Điểm trong tuyến', width: 14, value: (row) => row.routePlanned },
          { header: 'Điểm tuyến đã ghé', width: 14, value: (row) => row.routeVisited },
        ],
        result.rows,
      );
    } else if (result.group === 'don-vi') {
      base64 = await buildWorkbookBase64(
        sheet,
        [
          { header: 'Mã đơn vị', width: 14, value: (row) => row.code, numberFormat: '@' },
          { header: 'Đơn vị', width: 36, value: (row) => row.name },
          { header: 'Lượt ghé thăm', width: 14, value: (row) => row.visits },
          { header: 'Đại lý được ghé', width: 14, value: (row) => row.dealersVisited },
          { header: 'Đại lý đang hoạt động', width: 16, value: (row) => row.activeDealers },
          {
            header: '% độ phủ',
            width: 10,
            value: (row) => percentText(row.dealersVisited, row.activeDealers),
          },
          { header: 'Km', width: 10, value: (row) => row.km },
          ...targetCells<(typeof result.rows)[number]>(),
        ],
        result.rows,
      );
    } else {
      base64 = await buildWorkbookBase64(
        sheet,
        [
          { header: 'Mã đại lý', width: 16, value: (row) => row.code ?? '', numberFormat: '@' },
          { header: 'Tên đại lý', width: 36, value: (row) => row.name },
          { header: 'Cấp', width: 8, value: (row) => DEALER_LEVEL_LABEL[row.level] },
          { header: 'Đơn vị', width: 30, value: (row) => row.orgUnitName ?? '' },
          { header: 'Nhân viên phụ trách', width: 24, value: (row) => row.assignedUserName ?? '' },
          { header: 'Lượt ghé thăm', width: 14, value: (row) => row.visits },
          {
            header: 'Lần ghé gần nhất trong kỳ',
            width: 18,
            value: (row) => (row.lastVisitedAt ? formatDate(row.lastVisitedAt) : ''),
          },
        ],
        result.rows,
      );
    }
    return { ok: true, data: { fileName, base64 } };
  } catch (error) {
    return toActionError(error);
  }
}
