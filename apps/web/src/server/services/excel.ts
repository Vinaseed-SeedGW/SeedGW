import 'server-only';
import ExcelJS from 'exceljs';

export type ExcelColumn<TRow> = {
  header: string;
  width: number;
  value: (row: TRow) => string | number;
};

const BRAND_FONT = 'UTM Neo Sans Intel';
const BRAND_GREEN_ARGB = 'FF005B36';
const WHITE_ARGB = 'FFFFFFFF';

export async function buildWorkbookBase64<TRow>(
  sheetName: string,
  columns: ReadonlyArray<ExcelColumn<TRow>>,
  rows: readonly TRow[],
): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName, { views: [{ state: 'frozen', ySplit: 1 }] });

  sheet.columns = columns.map(({ header, width }) => ({
    header,
    width,
    style: { font: { name: BRAND_FONT, size: 11 } },
  }));
  for (const row of rows) sheet.addRow(columns.map((column) => column.value(row)));

  const headerRow = sheet.getRow(1);
  headerRow.font = { name: BRAND_FONT, size: 11, bold: true, color: { argb: WHITE_ARGB } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_GREEN_ARGB } };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer).toString('base64');
}
