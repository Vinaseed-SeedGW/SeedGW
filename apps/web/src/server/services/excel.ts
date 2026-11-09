import 'server-only';
import ExcelJS from 'exceljs';

export type ExcelColumn<TRow> = {
  header: string;
  width: number;
  value: (row: TRow) => string | number;
  // Giu nguyen so 0 dau va ngay dang chu khi nguoi dung go vao o.
  numberFormat?: '@';
};

export type ExcelSheet<TRow> = {
  name: string;
  columns: ReadonlyArray<ExcelColumn<TRow>>;
  rows: readonly TRow[];
};

const BRAND_FONT = 'UTM Neo Sans Intel';
const BRAND_GREEN_ARGB = 'FF005B36';
const WHITE_ARGB = 'FFFFFFFF';

function addSheet<TRow>(workbook: ExcelJS.Workbook, sheetSpec: ExcelSheet<TRow>): void {
  const sheet = workbook.addWorksheet(sheetSpec.name, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  sheet.columns = sheetSpec.columns.map(({ header, width, numberFormat }) => ({
    header,
    width,
    style: {
      font: { name: BRAND_FONT, size: 11 },
      ...(numberFormat ? { numFmt: numberFormat } : {}),
    },
  }));
  for (const row of sheetSpec.rows) {
    sheet.addRow(sheetSpec.columns.map((column) => column.value(row)));
  }

  const headerRow = sheet.getRow(1);
  headerRow.font = { name: BRAND_FONT, size: 11, bold: true, color: { argb: WHITE_ARGB } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_GREEN_ARGB } };
}

async function toBase64(workbook: ExcelJS.Workbook): Promise<string> {
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer).toString('base64');
}

export async function buildWorkbookBase64<TRow>(
  sheetName: string,
  columns: ReadonlyArray<ExcelColumn<TRow>>,
  rows: readonly TRow[],
): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  addSheet(workbook, { name: sheetName, columns, rows });
  return toBase64(workbook);
}

// Moi sheet co kieu dong rieng nen nhan ham ghi thay vi mang sheet.
export async function buildMultiSheetBase64(
  writers: ReadonlyArray<(workbook: ExcelJS.Workbook) => void>,
): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  for (const write of writers) write(workbook);
  return toBase64(workbook);
}

export function sheetWriter<TRow>(sheet: ExcelSheet<TRow>) {
  return (workbook: ExcelJS.Workbook) => addSheet(workbook, sheet);
}

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10).split('-').reverse().join('/');
  if (typeof value !== 'object') return String(value).trim();
  if ('richText' in value)
    return value.richText
      .map((part) => part.text)
      .join('')
      .trim();
  if ('hyperlink' in value) return String(value.text).trim();
  if ('formula' in value || 'sharedFormula' in value) return cellText(value.result ?? null);
  return '';
}

export type SheetRow = { rowNumber: number; cells: string[] };

// Tra null neu khong doc duoc file, vi file do nguoi dung tai len co the hong.
export async function readFirstSheet(
  data: ArrayBuffer,
  columnCount: number,
): Promise<SheetRow[] | null> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(data);
  } catch {
    return null;
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) return null;

  const rows: SheetRow[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const cells = Array.from({ length: columnCount }, (_, index) =>
      cellText(row.getCell(index + 1).value),
    );
    if (cells.some(Boolean)) rows.push({ rowNumber, cells });
  });
  return rows;
}
