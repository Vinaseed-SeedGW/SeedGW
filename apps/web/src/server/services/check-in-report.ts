import 'server-only';
import type { Prisma } from '@prisma/client';
import ExcelJS from 'exceljs';
import {
  CHECK_IN_FLAG_LABEL,
  checkInFlag,
  type CheckInRow,
  type ExportCheckInsInput,
} from '@dms/contracts/check-ins';
import { vietnamDayStart, vietnamNextDayStart } from '@dms/contracts/format';
import { escapeLikePattern, normalizeSearchText } from '@dms/contracts/text';
import { CHECK_IN_PHOTO_RETENTION_DAYS, presignGetUrl } from '@/server/integrations/object-storage';

export function checkInWhere(input: ExportCheckInsInput): Prisma.CheckInWhereInput {
  const search = input.q ? normalizeSearchText(input.q) : '';
  return {
    capturedAt: { gte: vietnamDayStart(input.from), lt: vietnamNextDayStart(input.to) },
    ...(search ? { user: { searchText: { contains: escapeLikePattern(search) } } } : {}),
    ...(input.placeKind ? { placeKind: input.placeKind } : {}),
    ...(input.flaggedOnly
      ? {
          OR: [
            { flags: { isEmpty: false } },
            { isDistanceEstimated: true },
            { isRoadEstimated: true },
          ],
        }
      : {}),
  };
}

// Như mẫu Excel cũ: theo đơn vị, theo nhân viên, giờ mới nhất ở trên.
export const CHECK_IN_ORDER_BY: Prisma.CheckInOrderByWithRelationInput[] = [
  { orgUnit: { name: 'asc' } },
  { user: { employeeCode: 'asc' } },
  { capturedAt: 'desc' },
  { id: 'asc' },
];

export const CHECK_IN_ROW_SELECT = {
  id: true,
  capturedAt: true,
  address: true,
  lat: true,
  lng: true,
  accuracyM: true,
  placeKind: true,
  placeName: true,
  note: true,
  roadDistanceKm: true,
  gpsDistanceKm: true,
  isDistanceEstimated: true,
  isRoadEstimated: true,
  dealerDistanceM: true,
  farReason: true,
  flags: true,
  photoKey: true,
  orgUnit: { select: { name: true } },
  user: { select: { employeeCode: true, fullName: true } },
} satisfies Prisma.CheckInSelect;

type CheckInRecord = Prisma.CheckInGetPayload<{ select: typeof CHECK_IN_ROW_SELECT }>;

const PHOTO_RETENTION_MS = CHECK_IN_PHOTO_RETENTION_DAYS * 86_400_000;

export function toCheckInRow(record: CheckInRecord, now = Date.now()): CheckInRow {
  // MinIO tự xoá ảnh sau 45 ngày, quá hạn thì không cấp link để không ra ảnh lỗi.
  const photoAlive = record.photoKey && now - record.capturedAt.getTime() < PHOTO_RETENTION_MS;
  return {
    id: record.id,
    orgUnitName: record.orgUnit?.name ?? null,
    employeeCode: record.user.employeeCode,
    employeeName: record.user.fullName,
    capturedAt: record.capturedAt.toISOString(),
    address: record.address,
    lat: record.lat,
    lng: record.lng,
    accuracyM: record.accuracyM,
    placeKind: record.placeKind,
    placeName: record.placeName,
    note: record.note,
    roadDistanceKm: record.roadDistanceKm,
    isRoadEstimated: record.isRoadEstimated,
    gpsDistanceKm: record.gpsDistanceKm,
    isDistanceEstimated: record.isDistanceEstimated,
    dealerDistanceM: record.dealerDistanceM,
    farReason: record.farReason,
    flags: record.flags.flatMap((flag) => {
      const parsed = checkInFlag.safeParse(flag);
      return parsed.success ? [parsed.data] : [];
    }),
    photoUrl: photoAlive && record.photoKey ? presignGetUrl(record.photoKey) : null,
  };
}

// ---------- File Excel theo mẫu Bao-cao-cu-ly-di-chuyen.xlsx (CHECK_IN_PLAN §6) ----------

const FONT = { name: 'Times New Roman', size: 11 } as const;
const BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' },
};
const KM_FORMAT = '_(* #,##0.000_);_(* \\(#,##0.000\\);_(* "-"??_);_(@_)';
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const EXCEL_EPOCH_DAYS = 25_569;

const COLUMNS = [
  { header: 'STT', width: 6 },
  { header: 'Tên đơn vị', width: 26 },
  { header: 'Mã nhân viên', width: 16 },
  { header: 'Tên nhân viên', width: 28 },
  { header: 'Ngày', width: 13 },
  { header: 'Thời gian checkin', width: 12 },
  { header: 'Địa chỉ', width: 46 },
  { header: 'Khách hàng', width: 24 },
  { header: 'Tên đại lý', width: 24 },
  { header: 'Ghi chú', width: 36 },
  { header: 'Khoảng cách (km)', width: 13 },
  { header: 'Khoảng cách theo GPS (km)', width: 15 },
] as const;

function excelDate(iso: string): number {
  return (Date.parse(iso) + VN_OFFSET_MS) / 86_400_000 + EXCEL_EPOCH_DAYS;
}

function vnTime(iso: string): string {
  return new Date(Date.parse(iso) + VN_OFFSET_MS).toISOString().slice(11, 16);
}

function noteText(row: CheckInRow): string {
  const parts = [row.placeKind === 'OTHER' ? `Điểm khác: ${row.placeName}` : '', row.note];
  if (row.isRoadEstimated) parts.push('Km theo đường ước tính do thiếu vết GPS');
  if (row.isDistanceEstimated) parts.push('Km GPS ước tính do thiếu vết GPS');
  for (const flag of row.flags) parts.push(CHECK_IN_FLAG_LABEL[flag]);
  if (row.flags.includes('FAR_FROM_DEALER') && row.dealerDistanceM !== null) {
    parts.push(`Cách đại lý ${Math.round(row.dealerDistanceM)} m`);
  }
  if (row.farReason) parts.push(`Lý do: ${row.farReason}`);
  return parts.filter(Boolean).join('. ');
}

export async function buildCheckInWorkbook(
  rows: readonly CheckInRow[],
  period: { from: string; to: string },
): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Báo cáo cự ly', {
    views: [{ state: 'frozen', ySplit: 5 }],
    pageSetup: { paperSize: 9, orientation: 'landscape' },
  });
  sheet.columns = COLUMNS.map((column) => ({ width: column.width, style: { font: FONT } }));

  sheet.mergeCells('A3:L3');
  const title = sheet.getCell('A3');
  title.value = 'BÁO CÁO CỰ LY DI CHUYỂN';
  title.font = { ...FONT, bold: true };
  title.alignment = { horizontal: 'center' };
  sheet.mergeCells('A4:L4');
  const [fy, fm, fd] = period.from.split('-');
  const [ty, tm, td] = period.to.split('-');
  sheet.getCell('A4').value = `Từ ngày ${fd}/${fm}/${fy} đến ngày ${td}/${tm}/${ty}`;
  sheet.getCell('A4').alignment = { horizontal: 'center' };

  const header = sheet.getRow(5);
  header.values = COLUMNS.map((column) => column.header);
  header.height = 32;
  header.eachCell((cell) => {
    cell.font = { ...FONT, bold: true };
    cell.border = BORDER;
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });

  rows.forEach((row, index) => {
    const added = sheet.addRow([
      index + 1,
      row.orgUnitName ?? '',
      row.employeeCode,
      row.employeeName,
      excelDate(row.capturedAt),
      vnTime(row.capturedAt),
      row.address ?? `Chưa có địa chỉ (toạ độ ${row.lat.toFixed(5)}, ${row.lng.toFixed(5)})`,
      row.placeKind === 'CUSTOMER' ? row.placeName : '',
      row.placeKind === 'DEALER' ? row.placeName : '',
      noteText(row),
      row.roadDistanceKm ?? null,
      row.gpsDistanceKm ?? null,
    ]);
    added.eachCell({ includeEmpty: true }, (cell, column) => {
      cell.border = BORDER;
      cell.alignment = { vertical: 'middle', wrapText: column >= 7 && column <= 10 };
      if (column === 5) cell.numFmt = 'd/mm/yyyy;@';
      if (column >= 11) cell.numFmt = KM_FORMAT;
      if (column <= 6) cell.alignment = { ...cell.alignment, horizontal: 'center' };
    });
  });

  const totalRow = sheet.addRow([]);
  const totalIndex = totalRow.number;
  sheet.mergeCells(`A${totalIndex}:J${totalIndex}`);
  totalRow.getCell(1).value = 'Tổng';
  totalRow.getCell(1).font = { ...FONT, bold: true };
  totalRow.getCell(1).alignment = { horizontal: 'center' };
  const sum = (pick: (row: CheckInRow) => number | null) =>
    Math.round(rows.reduce((total, row) => total + (pick(row) ?? 0), 0) * 1000) / 1000;
  totalRow.getCell(11).value = sum((row) => row.roadDistanceKm);
  totalRow.getCell(12).value = sum((row) => row.gpsDistanceKm);
  for (let column = 1; column <= 12; column += 1) {
    const cell = totalRow.getCell(column);
    cell.border = BORDER;
    if (column >= 11) cell.numFmt = KM_FORMAT;
  }

  sheet.addRow([]);
  const note = sheet.addRow([
    'Khoảng cách (km) tính theo đường đi thực tế giữa hai lượt check-in liền nhau; chặng mất vết GPS được nối bằng đường ngắn nhất và ghi ước tính ở cột Ghi chú. Ô trống là máy chủ chưa tính xong. Khoảng cách theo GPS đã bỏ điểm sai số lớn và gộp chỗ đứng yên.',
  ]);
  sheet.mergeCells(`A${note.number}:L${note.number}`);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer).toString('base64');
}
