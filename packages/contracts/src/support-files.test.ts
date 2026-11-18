import { describe, expect, it } from 'vitest';
import { cleanFileName, detectSupportFile, formatFileSize } from './support-files';

const bytes = (...values: number[]) => new Uint8Array([...values, ...new Array(16).fill(0)]);
const text = (value: string) => new Uint8Array([...value].map((char) => char.charCodeAt(0)));

describe('detectSupportFile', () => {
  it('accepts images and PDF by content', () => {
    expect(detectSupportFile(bytes(0xff, 0xd8, 0xff, 0xe0), 'anh.png')?.mimeType).toBe(
      'image/jpeg',
    );
    expect(
      detectSupportFile(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a), 'x')?.extension,
    ).toBe('png');
    expect(detectSupportFile(text('RIFF\0\0\0\0WEBPVP8 '), 'a.webp')?.extension).toBe('webp');
    expect(detectSupportFile(text('\0\0\0\x18ftypheic'), 'IMG_1.HEIC')?.extension).toBe('heic');
    expect(detectSupportFile(text('%PDF-1.7'), 'bao-cao.pdf')?.extension).toBe('pdf');
  });

  it('tells Excel from Word by extension for zip and OLE files', () => {
    const zip = bytes(0x50, 0x4b, 0x03, 0x04);
    expect(detectSupportFile(zip, 'so-lieu.xlsx')?.extension).toBe('xlsx');
    expect(detectSupportFile(zip, 'van-ban.DOCX')?.extension).toBe('docx');
    expect(detectSupportFile(zip, 'goi.zip')).toBeNull();
    const ole = bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1);
    expect(detectSupportFile(ole, 'cu.xls')?.extension).toBe('xls');
    expect(detectSupportFile(ole, 'cu.doc')?.extension).toBe('doc');
    expect(detectSupportFile(ole, 'cu.msi')).toBeNull();
  });

  it('rejects an executable renamed to a picture', () => {
    expect(detectSupportFile(text('MZ\x90\0'), 'anh-man-hinh.jpg')).toBeNull();
    expect(detectSupportFile(text('MZ\x90\0'), 'cai-dat.exe')).toBeNull();
  });
});

describe('cleanFileName', () => {
  it('drops folders, control characters and uses the detected extension', () => {
    const kind = { mimeType: 'image/png', extension: 'png', isImage: true };
    expect(cleanFileName('C:\\Users\\a\\Ảnh lỗi.PNG', kind)).toBe('Ảnh lỗi.png');
    expect(cleanFileName('../../x\u0007.exe', kind)).toBe('x.png');
    expect(cleanFileName('', kind)).toBe('tep.png');
  });
});

describe('formatFileSize', () => {
  it('formats KB and MB', () => {
    expect(formatFileSize(850 * 1024)).toBe('850 KB');
    expect(formatFileSize(2.4 * 1024 * 1024)).toBe('2,4 MB');
  });
});
