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

export function formatDateTime(iso: string): string {
  return vietnamDateTime.format(new Date(iso)).replace(', ', ' ');
}

export function formatVnd(value: number): string {
  return `${vietnameseNumber.format(value)} đ`;
}

export function formatDate(iso: string): string {
  return vietnamDate.format(new Date(iso));
}
