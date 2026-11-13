// Tự ghi file .xlsx (zip không nén chứa các file XML) để không phải thêm thư viện Excel nặng vào app.
// Định dạng chữ, viền, số theo mẫu "Bao-cao-cu-ly-di-chuyen.xlsx": Times New Roman 11, km 3 số lẻ.

export type CellStyle =
  'plain' | 'title' | 'header' | 'body' | 'text' | 'date' | 'km' | 'label' | 'link';

const STYLE_INDEX: Record<CellStyle, number> = {
  plain: 1,
  header: 2,
  body: 3,
  date: 4,
  km: 5,
  title: 6,
  text: 7,
  label: 8,
  link: 9,
};

export type Cell =
  | { kind: 'text'; value: string; style: CellStyle }
  | { kind: 'number'; value: number; style: CellStyle }
  | { kind: 'link'; url: string; label: string; style: CellStyle }
  | null;

export type SheetRow = { cells: Cell[]; heightPt?: number };

export type SheetImage = {
  /** Dòng, cột tính từ 0. */
  row: number;
  col: number;
  jpeg: Uint8Array;
  widthPx: number;
  heightPx: number;
};

export type Sheet = {
  name: string;
  columnWidths: number[];
  rows: SheetRow[];
  merges?: string[];
  images?: SheetImage[];
  /** Giữ cố định các dòng phía trên khi cuộn, ví dụ 5 để luôn thấy dòng tiêu đề cột. */
  freezeRows?: number;
};

export const text = (value: string, style: CellStyle = 'body'): Cell => ({
  kind: 'text',
  value,
  style,
});
export const num = (value: number, style: CellStyle = 'body'): Cell => ({
  kind: 'number',
  value,
  style,
});

const EXCEL_EPOCH_OFFSET_DAYS = 25_569;
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const EMU_PER_PX = 9_525;

/** Đổi epoch ms ra số ngày kiểu Excel theo giờ Việt Nam, để ô ngày hiện đúng d/mm/yyyy. */
export function excelDateVn(epochMs: number): number {
  return (epochMs + VN_OFFSET_MS) / 86_400_000 + EXCEL_EPOCH_OFFSET_DAYS;
}

export function columnLetter(index: number): string {
  let n = index + 1;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function escapeXml(value: string): string {
  return (
    value
      // Ký tự điều khiển làm Excel báo file hỏng.
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  );
}

function cellXml(cell: Cell, ref: string): string {
  if (!cell) return '';
  const s = STYLE_INDEX[cell.style];
  switch (cell.kind) {
    case 'text':
      return `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(cell.value)}</t></is></c>`;
    case 'number':
      return Number.isFinite(cell.value) ? `<c r="${ref}" s="${s}"><v>${cell.value}</v></c>` : '';
    case 'link': {
      const formula = `HYPERLINK("${cell.url.replace(/"/g, '""')}","${cell.label.replace(/"/g, '""')}")`;
      return `<c r="${ref}" s="${s}" t="str"><f>${escapeXml(formula)}</f><v>${escapeXml(cell.label)}</v></c>`;
    }
  }
}

function sheetXml(sheet: Sheet, hasDrawing: boolean): string {
  const cols = sheet.columnWidths
    .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
    .join('');
  const rows = sheet.rows
    .map((row, r) => {
      const height = row.heightPt ? ` ht="${row.heightPt}" customHeight="1"` : '';
      const cells = row.cells
        .map((cell, c) => cellXml(cell, `${columnLetter(c)}${r + 1}`))
        .join('');
      return `<row r="${r + 1}"${height}>${cells}</row>`;
    })
    .join('');
  const merges = sheet.merges?.length
    ? `<mergeCells count="${sheet.merges.length}">${sheet.merges.map((m) => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>`
    : '';
  const freeze = sheet.freezeRows
    ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${sheet.freezeRows}" topLeftCell="A${sheet.freezeRows + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
    : '';
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    `${freeze}<sheetFormatPr defaultRowHeight="15"/><cols>${cols}</cols><sheetData>${rows}</sheetData>${merges}` +
    '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>' +
    '<pageSetup paperSize="9" orientation="landscape"/>' +
    (hasDrawing ? '<drawing r:id="rId1"/>' : '') +
    '</worksheet>'
  );
}

function drawingXml(images: readonly SheetImage[]): string {
  const anchors = images
    .map((image, i) => {
      const cx = Math.round(image.widthPx * EMU_PER_PX);
      const cy = Math.round(image.heightPx * EMU_PER_PX);
      return (
        `<xdr:oneCellAnchor><xdr:from><xdr:col>${image.col}</xdr:col><xdr:colOff>${4 * EMU_PER_PX}</xdr:colOff>` +
        `<xdr:row>${image.row}</xdr:row><xdr:rowOff>${4 * EMU_PER_PX}</xdr:rowOff></xdr:from><xdr:ext cx="${cx}" cy="${cy}"/>` +
        `<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${i + 2}" name="Anh ${i + 1}"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>` +
        `<xdr:blipFill><a:blip r:embed="rId${i + 1}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>` +
        `<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr>` +
        '</xdr:pic><xdr:clientData/></xdr:oneCellAnchor>'
      );
    })
    .join('');
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    `${anchors}</xdr:wsDr>`
  );
}

const STYLES_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<numFmts count="2"><numFmt numFmtId="164" formatCode="d/mm/yyyy;@"/>' +
  '<numFmt numFmtId="165" formatCode="_(* #,##0.000_);_(* \\(#,##0.000\\);_(* &quot;-&quot;??_);_(@_)"/></numFmts>' +
  '<fonts count="4">' +
  '<font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font>' +
  '<font><sz val="11"/><color theme="1"/><name val="Times New Roman"/><family val="1"/></font>' +
  '<font><b/><sz val="11"/><color theme="1"/><name val="Times New Roman"/><family val="1"/></font>' +
  '<font><u/><sz val="11"/><color theme="10"/><name val="Times New Roman"/><family val="1"/></font>' +
  '</fonts>' +
  '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
  '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>' +
  '<border><left style="thin"><color auto="1"/></left><right style="thin"><color auto="1"/></right><top style="thin"><color auto="1"/></top><bottom style="thin"><color auto="1"/></bottom><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="10">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
  '<xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>' +
  '<xf numFmtId="164" fontId="1" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
  '<xf numFmtId="165" fontId="1" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>' +
  '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center"/></xf>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>' +
  '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top"/></xf>' +
  '<xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>' +
  '</cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '</styleSheet>';

function workbookXml(sheets: readonly Sheet[]): string {
  const items = sheets
    .map(
      (sheet, i) =>
        `<sheet name="${escapeXml(sheet.name.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`,
    )
    .join('');
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    `<sheets>${items}</sheets></workbook>`
  );
}

function relsXml(entries: readonly { id: string; type: string; target: string }[]): string {
  const items = entries
    .map(
      (e) =>
        `<Relationship Id="${e.id}" Type="http://schemas.openxmlformats.org/${e.type}" Target="${e.target}"/>`,
    )
    .join('');
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${items}</Relationships>`
  );
}

const OFFICE_REL = 'officeDocument/2006/relationships';

export function buildXlsx(sheets: readonly Sheet[]): Uint8Array {
  const encoder = new TextEncoder();
  const files: { name: string; data: Uint8Array }[] = [];
  const add = (name: string, content: string | Uint8Array) =>
    files.push({ name, data: typeof content === 'string' ? encoder.encode(content) : content });

  const overrides: string[] = [];
  let imageCounter = 0;
  sheets.forEach((sheet, i) => {
    const n = i + 1;
    const images = sheet.images ?? [];
    add(`xl/worksheets/sheet${n}.xml`, sheetXml(sheet, images.length > 0));
    overrides.push(
      `<Override PartName="/xl/worksheets/sheet${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    );
    if (images.length === 0) return;
    add(
      `xl/worksheets/_rels/sheet${n}.xml.rels`,
      relsXml([
        { id: 'rId1', type: `${OFFICE_REL}/drawing`, target: `../drawings/drawing${n}.xml` },
      ]),
    );
    add(`xl/drawings/drawing${n}.xml`, drawingXml(images));
    overrides.push(
      `<Override PartName="/xl/drawings/drawing${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`,
    );
    const imageRels = images.map((image, k) => {
      imageCounter += 1;
      add(`xl/media/image${imageCounter}.jpeg`, image.jpeg);
      return {
        id: `rId${k + 1}`,
        type: `${OFFICE_REL}/image`,
        target: `../media/image${imageCounter}.jpeg`,
      };
    });
    add(`xl/drawings/_rels/drawing${n}.xml.rels`, relsXml(imageRels));
  });

  add('xl/workbook.xml', workbookXml(sheets));
  add('xl/styles.xml', STYLES_XML);
  add(
    'xl/_rels/workbook.xml.rels',
    relsXml([
      ...sheets.map((_, i) => ({
        id: `rId${i + 1}`,
        type: `${OFFICE_REL}/worksheet`,
        target: `worksheets/sheet${i + 1}.xml`,
      })),
      { id: `rId${sheets.length + 1}`, type: `${OFFICE_REL}/styles`, target: 'styles.xml' },
    ]),
  );
  add(
    '_rels/.rels',
    relsXml([{ id: 'rId1', type: `${OFFICE_REL}/officeDocument`, target: 'xl/workbook.xml' }]),
  );
  add(
    '[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Default Extension="jpeg" ContentType="image/jpeg"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      `${overrides.join('')}</Types>`,
  );

  // [Content_Types].xml nên đứng đầu file zip.
  const ordered = [files[files.length - 1], ...files.slice(0, -1)].filter(
    (f): f is { name: string; data: Uint8Array } => Boolean(f),
  );
  return zipStore(ordered);
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    crc = (CRC_TABLE[(crc ^ (data[i] ?? 0)) & 0xff] ?? 0) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Đóng gói zip kiểu "store" (không nén). Excel, Numbers, Google Sheets đều mở được. */
function zipStore(files: readonly { name: string; data: Uint8Array }[]): Uint8Array {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  // Giờ DOS cố định 01/01/2026 00:00, không ảnh hưởng nội dung.
  const dosTime = 0;
  const dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1;

  for (const file of files) {
    const name = encoder.encode(file.name);
    const crc = crc32(file.data);
    const size = file.data.length;

    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true);
    lv.setUint16(8, 0, true);
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, name.length, true);
    lv.setUint16(28, 0, true);
    local.set(name, 30);

    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    central.set(name, 46);

    locals.push(local, file.data);
    centrals.push(central);
    offset += local.length + size;
  }

  const centralSize = centrals.reduce((sum, c) => sum + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  const out = new Uint8Array(offset + centralSize + end.length);
  let cursor = 0;
  for (const part of [...locals, ...centrals, end]) {
    out.set(part, cursor);
    cursor += part.length;
  }
  return out;
}

/** Đọc kích thước ảnh JPEG từ phần đầu file, để chèn ảnh vào Excel đúng tỉ lệ. */
export function jpegSize(bytes: Uint8Array): { width: number; height: number } | null {
  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) return null;
    const marker = bytes[i + 1] ?? 0;
    const length = ((bytes[i + 2] ?? 0) << 8) | (bytes[i + 3] ?? 0);
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const height = ((bytes[i + 5] ?? 0) << 8) | (bytes[i + 6] ?? 0);
      const width = ((bytes[i + 7] ?? 0) << 8) | (bytes[i + 8] ?? 0);
      return { width, height };
    }
    i += 2 + length;
  }
  return null;
}

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const BASE64_LOOKUP = (() => {
  const table = new Uint8Array(128);
  for (let i = 0; i < BASE64.length; i += 1) table[BASE64.charCodeAt(i)] = i;
  return table;
})();

/** Giải mã phần base64 của data URI ảnh đã lưu trong SQLite. */
export function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = BASE64_LOOKUP[clean.charCodeAt(i)] ?? 0;
    const b = BASE64_LOOKUP[clean.charCodeAt(i + 1)] ?? 0;
    const c = BASE64_LOOKUP[clean.charCodeAt(i + 2)] ?? 0;
    const d = BASE64_LOOKUP[clean.charCodeAt(i + 3)] ?? 0;
    const triple = (a << 18) | (b << 12) | (c << 6) | d;
    if (o < out.length) out[o++] = (triple >> 16) & 0xff;
    if (o < out.length) out[o++] = (triple >> 8) & 0xff;
    if (o < out.length) out[o++] = triple & 0xff;
  }
  return out;
}
