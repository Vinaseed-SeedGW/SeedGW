const vietnameseNumber = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });

const vietnamDate = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'Asia/Ho_Chi_Minh',
});

export function formatVnd(value: number): string {
  return `${vietnameseNumber.format(value)} đ`;
}

export function formatDate(iso: string): string {
  return vietnamDate.format(new Date(iso));
}
