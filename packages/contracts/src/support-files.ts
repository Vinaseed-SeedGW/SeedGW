// Tệp đính kèm yêu cầu hỗ trợ (T5): chỉ ảnh, PDF, Excel, Word dưới 10 MB.
// Nhận dạng theo vài byte đầu của tệp, không tin đuôi tệp hay loại trình duyệt báo, nên .exe đổi tên vẫn bị chặn.

export const SUPPORT_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const SUPPORT_MAX_FILES_PER_MESSAGE = 5;
export const SUPPORT_FILE_ACCEPT =
  'image/jpeg,image/png,image/webp,image/heic,.pdf,.xlsx,.xls,.docx,.doc';
export const SUPPORT_FILE_RULE_TEXT =
  'Ảnh, PDF, Excel hoặc Word, mỗi tệp dưới 10 MB, tối đa 5 tệp.';

export type SupportFileKind = { mimeType: string; extension: string; isImage: boolean };

const IMAGE_JPEG = { mimeType: 'image/jpeg', extension: 'jpg', isImage: true };
const IMAGE_PNG = { mimeType: 'image/png', extension: 'png', isImage: true };
const IMAGE_WEBP = { mimeType: 'image/webp', extension: 'webp', isImage: true };
const IMAGE_HEIC = { mimeType: 'image/heic', extension: 'heic', isImage: true };
const PDF = { mimeType: 'application/pdf', extension: 'pdf', isImage: false };
const XLSX = {
  mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  extension: 'xlsx',
  isImage: false,
};
const DOCX = {
  mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  extension: 'docx',
  isImage: false,
};
const XLS = { mimeType: 'application/vnd.ms-excel', extension: 'xls', isImage: false };
const DOC = { mimeType: 'application/msword', extension: 'doc', isImage: false };

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  return signature.every((value, index) => bytes[offset + index] === value);
}

function ascii(bytes: Uint8Array, from: number, length: number): string {
  return String.fromCharCode(...bytes.slice(from, from + length));
}

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : '';
}

/**
 * Loại tệp theo nội dung. Excel, Word đời mới là tệp nén ZIP, đời cũ là tệp OLE, hai loại này
 * cùng chữ ký nên dựa thêm đuôi tệp để biết Excel hay Word. Trả null là tệp không được nhận.
 */
export function detectSupportFile(bytes: Uint8Array, fileName: string): SupportFileKind | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return IMAGE_JPEG;
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return IMAGE_PNG;
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return IMAGE_WEBP;
  if (
    ascii(bytes, 4, 4) === 'ftyp' &&
    ['heic', 'heix', 'mif1', 'msf1'].includes(ascii(bytes, 8, 4))
  ) {
    return IMAGE_HEIC;
  }
  if (ascii(bytes, 0, 5) === '%PDF-') return PDF;
  const extension = extensionOf(fileName);
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    if (extension === 'xlsx') return XLSX;
    if (extension === 'docx') return DOCX;
    return null;
  }
  if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
    if (extension === 'xls') return XLS;
    if (extension === 'doc') return DOC;
    return null;
  }
  return null;
}

/** Tên tệp an toàn để lưu và hiện: bỏ đường dẫn, ký tự điều khiển, cắt còn 120 ký tự. */
export function cleanFileName(fileName: string, kind: SupportFileKind): string {
  const base = (fileName.split(/[\\/]/).pop() ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim();
  const stem = base.replace(/\.[^.]*$/, '').slice(0, 110) || 'tep';
  return `${stem}.${kind.extension}`;
}

/** Cỡ tệp dễ đọc: 850 KB, 2,4 MB. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}
