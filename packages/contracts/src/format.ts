const vietnameseNumber = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });

const vietnamDate = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'Asia/Ho_Chi_Minh',
});

const vietnamDateTime = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Asia/Ho_Chi_Minh',
});

// Doi dd/mm/yyyy hoac yyyy-mm-dd sang yyyy-mm-dd, tra null neu ngay khong co that tren lich.
export function parseDisplayDate(text: string): string | null {
  const value = text.trim();
  const vietnamese = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const parts = vietnamese
    ? { day: vietnamese[1], month: vietnamese[2], year: vietnamese[3] }
    : iso
      ? { day: iso[3], month: iso[2], year: iso[1] }
      : null;
  if (!parts) return null;

  const [year, month, day] = [Number(parts.year), Number(parts.month), Number(parts.day)];
  const date = new Date(Date.UTC(year, month - 1, day));
  const isReal =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return isReal ? date.toISOString().slice(0, 10) : null;
}

export function formatDateTime(iso: string): string {
  return vietnamDateTime.format(new Date(iso)).replace(', ', ' ');
}

export function formatNumber(value: number): string {
  return vietnameseNumber.format(value);
}

const ONE_DAY_MS = 86_400_000;

// Moc dau ngay theo gio Viet Nam cua ngay dang yyyy-mm-dd.
export function vietnamDayStart(date: string): Date {
  return new Date(`${date}T00:00:00+07:00`);
}

export function vietnamNextDayStart(date: string): Date {
  return new Date(vietnamDayStart(date).getTime() + ONE_DAY_MS);
}

export function formatVnd(value: number): string {
  return `${vietnameseNumber.format(value)} đ`;
}

export function formatDate(iso: string): string {
  return vietnamDate.format(new Date(iso));
}

// Ngay chi co yyyy-mm-dd, chuoi rong nghia la chua nhap.
export function formatDateOnly(value: string): string | null {
  return value === '' ? null : formatDate(`${value}T00:00:00.000Z`);
}
